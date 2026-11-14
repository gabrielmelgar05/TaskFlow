export async function selectOption(trigger, value) {
  await trigger.click();
  const page = trigger.page();
  if (typeof value === "object")
    await page.getByRole("option", { name: value.label, exact: true }).click();
  else
    await page.locator(`[role=option][data-select-value="${value}"]`).click();
}
