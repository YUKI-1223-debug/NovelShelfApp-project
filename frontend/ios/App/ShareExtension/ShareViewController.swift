import UIKit
import UniformTypeIdentifiers

/// 共有シートの「NovelShelf」(個人利用アプリ化 S2-8)。
///
/// 共有された作品ページの URL を、NovelShelf の API(ミニPCの tailnet 入口)に直接送って本棚に追加する。
/// ログインは廃止した(サーバーのオーナー固定モードが tailnet からのリクエストをオーナーとして扱う)ので、
/// トークンを本体と共有する App Group は要らない。iPhone の Tailscale が ON なら Extension の通信も tailnet を通る。
/// 当初の設計(URL スキームで本体を開くだけ)は、iOS 18 で Extension から本体を開く方法が不安定なため採らなかった。
final class ShareViewController: UIViewController {

    private let card = UIView()
    private let titleLabel = UILabel()
    private let messageLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let closeButton = UIButton(type: .system)
    private var started = false

    private var apiBase: String {
        (Bundle.main.object(forInfoDictionaryKey: "NovelShelfApiBaseUrl") as? String)
            ?? "https://minipc.tail0347f4.ts.net:8445/api/v1"
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.black.withAlphaComponent(0.35)

        card.backgroundColor = .systemBackground
        card.layer.cornerRadius = 14
        card.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(card)

        titleLabel.text = "NovelShelf"
        titleLabel.font = .preferredFont(forTextStyle: .headline)
        messageLabel.text = "本棚に追加しています…"
        messageLabel.font = .preferredFont(forTextStyle: .subheadline)
        messageLabel.numberOfLines = 0
        messageLabel.textAlignment = .center
        spinner.startAnimating()
        closeButton.setTitle("閉じる", for: .normal)
        closeButton.isHidden = true
        closeButton.addTarget(self, action: #selector(close), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [titleLabel, spinner, messageLabel, closeButton])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            card.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.8),
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 20),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -20),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !started else { return }
        started = true
        Task { await run() }
    }

    @MainActor
    private func run() async {
        guard let url = await sharedURL() else {
            finish(success: false, message: "共有された内容に作品の URL が見つかりませんでした。")
            return
        }
        do {
            let novel = try await post(path: "/novels/resolve", body: ["url": url.absoluteString])
            guard let novelId = novel["id"] as? String else {
                throw ShareError.message("作品の情報を読み取れませんでした。")
            }
            _ = try await post(path: "/shelf", body: ["novelId": novelId, "status": "READING"])
            let title = (novel["title"] as? String) ?? "作品"
            finish(success: true, message: "「\(title)」を本棚に追加しました。")
        } catch ShareError.message(let text) {
            finish(success: false, message: text)
        } catch {
            finish(
                success: false,
                message: "サーバーに接続できません。Tailscale が ON か確認してください（平日 1:00〜7:00 はミニPCが休止中です）。")
        }
    }

    /// 共有された URL。Safari などは URL を、ほかのアプリは「タイトル + URL」の文字列を渡してくることがある。
    private func sharedURL() async -> URL? {
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
            .flatMap { $0.attachments ?? [] }
        for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            if let item = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil),
               let url = item as? URL, url.scheme?.hasPrefix("http") == true {
                return url
            }
        }
        for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            if let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) as? String,
               let url = firstWebURL(in: text) {
                return url
            }
        }
        return nil
    }

    private func firstWebURL(in text: String) -> URL? {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else {
            return nil
        }
        let range = NSRange(text.startIndex..., in: text)
        return detector.matches(in: text, range: range)
            .compactMap { $0.url }
            .first { $0.scheme?.hasPrefix("http") == true }
    }

    private func post(path: String, body: [String: String]) async throws -> [String: Any] {
        guard let endpoint = URL(string: apiBase + path) else {
            throw ShareError.message("API の URL が不正です。")
        }
        var request = URLRequest(url: endpoint, timeoutInterval: 20)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        if status == 401 {
            throw ShareError.message("このネットワークからは使えません。Tailscale が ON か確認してください。")
        }
        guard (200..<300).contains(status) else {
            throw ShareError.message((json["message"] as? String) ?? "追加できませんでした（\(status)）。")
        }
        return json
    }

    @MainActor
    private func finish(success: Bool, message: String) {
        spinner.stopAnimating()
        spinner.isHidden = true
        messageLabel.text = message
        if success {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in self?.close() }
        } else {
            closeButton.isHidden = false
        }
    }

    @objc private func close() {
        extensionContext?.completeRequest(returningItems: nil)
    }

    private enum ShareError: Error {
        case message(String)
    }
}
