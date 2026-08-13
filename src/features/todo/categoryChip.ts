/**
 * 分类 chip 的样式。
 *
 * 抽出来是因为它有两个使用处:分类栏(筛选 + 新建默认分类)和待办编辑态(给这一条
 * 归类)。两边必须长得一模一样——它们表达的是同一个概念,看起来不一样就会让人
 * 以为是两种不同的东西。各写一份 class 串迟早漂,所以这里是唯一来源。
 */
export const chip =
  "shrink-0 rounded-full border px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
export const chipOn = "border-accent bg-accent-soft font-medium text-accent-ink";
export const chipOff = "border-line text-muted hover:border-accent hover:text-ink";

/** chip 的完整 class:按是否选中拼好。 */
export function chipClass(on: boolean): string {
  return `${chip} ${on ? chipOn : chipOff}`;
}
