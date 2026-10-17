import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settingsApi } from "@/lib/api";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, SettingsProvider, useSettings } from "./SettingsProvider";

function Probe() {
  const { settings, isLoading, update } = useSettings();
  if (isLoading) return <p>loading</p>;
  return (
    <div>
      <p data-testid="fontSize">{settings.fontSize}</p>
      <button onClick={() => update({ fontSize: 22 })}>bigger</button>
    </div>
  );
}

describe("SettingsProvider (表示設定は端末ごと)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("imports the server settings on the first launch and stores them on the device", async () => {
    const get = vi.spyOn(settingsApi, "get").mockResolvedValue({ ...DEFAULT_SETTINGS, fontSize: 19 });

    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId("fontSize").textContent).toBe("19"));
    expect(get).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY)!).fontSize).toBe(19);
  });

  it("uses only the device settings afterwards (does not read the server)", async () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, fontSize: 14 }));
    const get = vi.spyOn(settingsApi, "get");

    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId("fontSize").textContent).toBe("14"));
    expect(get).not.toHaveBeenCalled();
  });

  it("saves changes to the device only (never sends them to the server)", async () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    const put = vi.spyOn(settingsApi, "update");

    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>
    );
    await waitFor(() => screen.getByText("bigger"));
    await act(async () => {
      screen.getByText("bigger").click();
    });

    expect(screen.getByTestId("fontSize").textContent).toBe("22");
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY)!).fontSize).toBe(22);
    expect(put).not.toHaveBeenCalled();
  });

  it("falls back to defaults offline and tries to import again next time", async () => {
    vi.spyOn(settingsApi, "get").mockRejectedValue(new Error("offline"));

    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId("fontSize").textContent).toBe(String(DEFAULT_SETTINGS.fontSize)));
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it("fills in settings added later with defaults", async () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ fontSize: 18 }));

    const onSettings = vi.fn();
    function Capture() {
      const { settings, isLoading } = useSettings();
      if (!isLoading) onSettings(settings);
      return null;
    }
    render(
      <SettingsProvider>
        <Capture />
      </SettingsProvider>
    );

    await waitFor(() => expect(onSettings).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, fontSize: 18 }));
  });
});
