export function getFormValue<T,>(form: HTMLFormElement, name: string): T | undefined {
	if (!(name in form.elements)) return undefined
	const element = form.elements[name as keyof typeof form.elements]
	if (element instanceof RadioNodeList) return element.value as T
	if (element instanceof HTMLSelectElement) return element.value as T
	if (element instanceof HTMLInputElement) {
		if (element.type === 'hidden') {
			return element.value as T
		}
		if (element.type === 'range') {
			return element.valueAsNumber as T
		}
		if (element.type === 'checkbox') {
			return element.checked as T
		}
		if (element.type === 'number') {
			return element.valueAsNumber as T
		}
		return element.value as T
	}
	if (element instanceof HTMLTextAreaElement) {
		return element.value as T
	}
}