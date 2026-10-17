# iOS の Share Extension(frontend/ios/App/ShareExtension)を App.xcodeproj に追加する(個人利用アプリ化 S2-8)。
#
# Mac が無く Xcode でターゲットを足せないため、Codemagic の Mac 上で `npx cap sync ios` のあとに実行する
# (codemagic.yaml の「Share Extension を Xcode プロジェクトに追加」)。project.pbxproj は手で書き換えない。
# 既に追加済みなら何もしない(何度実行してもよい)。
#
#   ruby scripts/add_share_extension.rb frontend/ios/App/App.xcodeproj
begin
  require 'xcodeproj'
rescue LoadError
  system('gem install xcodeproj --no-document --user-install') || abort('xcodeproj gem を入れられませんでした')
  Gem.clear_paths
  require 'xcodeproj'
end

EXT_NAME = 'ShareExtension'
EXT_BUNDLE_ID = 'jp.novelshelf.app.ShareExtension'

project_path = ARGV[0] || 'frontend/ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |t| t.name == 'App' } or abort('App ターゲットが見つかりません')

if project.targets.any? { |t| t.name == EXT_NAME }
  puts "#{EXT_NAME} は追加済みです"
  exit 0
end

app_settings = app.build_configurations.first.build_settings
deployment_target = app_settings['IPHONEOS_DEPLOYMENT_TARGET'] || '15.0'

ext = project.new_target(:app_extension, EXT_NAME, :ios, deployment_target)

group = project.main_group.find_subpath(EXT_NAME, true)
group.set_source_tree('<group>')
group.set_path(EXT_NAME)
swift = group.new_reference('ShareViewController.swift')
group.new_reference('Info.plist')
ext.add_file_references([swift])

ext.build_configurations.each do |config|
  app_config = app.build_configurations.find { |c| c.name == config.name } || app.build_configurations.first
  s = config.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = EXT_BUNDLE_ID
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['INFOPLIST_FILE'] = "#{EXT_NAME}/Info.plist"
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['SWIFT_VERSION'] = app_config.build_settings['SWIFT_VERSION'] || '5.0'
  s['TARGETED_DEVICE_FAMILY'] = app_config.build_settings['TARGETED_DEVICE_FAMILY'] || '1,2'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = deployment_target
  # 本体と同じ版にする(App Store Connect は Extension と本体の CFBundleShortVersionString / CFBundleVersion の一致を求める)。
  # ビルド番号は後の agvtool new-version -all で両方まとめて上がる
  s['MARKETING_VERSION'] = app_config.build_settings['MARKETING_VERSION'] || '1.0'
  s['CURRENT_PROJECT_VERSION'] = app_config.build_settings['CURRENT_PROJECT_VERSION'] || '1'
  s['SKIP_INSTALL'] = 'YES'
  s['CODE_SIGN_STYLE'] = app_config.build_settings['CODE_SIGN_STYLE'] || 'Automatic'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
end

# 本体に埋め込む(Embed App Extensions → PlugIns)
app.add_dependency(ext)
embed = app.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' || p.name == 'Embed App Extensions' }
embed ||= app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
build_file = embed.add_file_reference(ext.product_reference, true)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

project.save
puts "#{EXT_NAME}(#{EXT_BUNDLE_ID})を #{project_path} に追加しました"
