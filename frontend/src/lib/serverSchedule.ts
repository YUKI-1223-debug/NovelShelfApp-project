/**
 * ミニPCの休止スケジュール(AI秘書の開発者モードで設定。平日 1:00 に休止し、7:00 に rtcwake で復帰する)。
 * 接続できないときの案内文を出し分けるためだけに使う(スケジュールを変えたら、ここも合わせる)。
 */
export const SLEEP_START_HOUR = 1;
export const SLEEP_END_HOUR = 7;

/** 端末の時刻で、ミニPCが休止している時間帯(月〜金の 1:00〜7:00)かどうか。 */
export function isServerSleepWindow(now: Date = new Date()): boolean {
  const day = now.getDay(); // 0=日 … 6=土
  const isWeekday = day >= 1 && day <= 5;
  const hour = now.getHours();
  return isWeekday && hour >= SLEEP_START_HOUR && hour < SLEEP_END_HOUR;
}
