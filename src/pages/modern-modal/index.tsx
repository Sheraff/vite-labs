import { Head } from "#components/Head"
import {
	cloneElement,
	useEffect,
	useId,
	useRef,
	useState,
	type CSSProperties,
	type FocusEvent,
	type MouseEvent,
	type ReactElement,
	type ReactNode,
} from "react"
import { flushSync } from "react-dom"

import styles from "./styles.module.css"

export const meta = {
	title: "Modern Modal",
	tags: ["html", "components"],
}

declare module "react" {
	interface CSSProperties {
		anchorName?: string
		positionAnchor?: string
	}

	interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
		popovertarget?: string
		popovertargetaction?: "show" | "hide" | "toggle"
	}
}

export default function ModernModal() {
	const [openModal, setOpenModal] = useState(false)
	const [openDrawer, setOpenDrawer] = useState(false)
	return (
		<div className={styles.main}>
			<Head />

			<hr />

			<button type="button" onClick={() => setOpenModal(true)}>
				Open Modal
			</button>
			<Modal open={openModal} onClose={() => setOpenModal(false)}>
				<div>Modal Content</div>
			</Modal>

			<hr />

			<button type="button" onClick={() => setOpenDrawer(true)}>
				Open Drawer
			</button>
			<Drawer open={openDrawer} onClose={() => setOpenDrawer(false)}>
				<div>Drawer Content</div>
			</Drawer>

			<hr />

			<Tooltip text="hello world">
				<button>Hover me to see a tooltip</button>
			</Tooltip>

			<hr />

			<Toast />
			<button
				type="button"
				onClick={() => dispatchToast("Hello World - " + (Math.random() * 10).toString(36).slice(2))}
			>
				Show Toast
			</button>
		</div>
	)
}

function Modal({ open, onClose, children }: { open: boolean; children: ReactNode; onClose?: () => void }) {
	const ref = useRef<HTMLDialogElement>(null)
	useEffect(() => {
		if (open) {
			ref.current?.showModal()
		} else {
			ref.current?.close()
		}
	}, [open])
	return (
		<dialog className={styles.dialog} ref={ref} onClose={onClose}>
			<button type="button" autoFocus onClick={(e) => e.currentTarget.closest<HTMLDialogElement>("dialog")!.close()}>
				Close
			</button>
			{children}
			<form method="dialog">
				<button>OK</button>
			</form>
		</dialog>
	)
}

function Drawer({ open, onClose, children }: { open: boolean; children: ReactNode; onClose?: () => void }) {
	const ref = useRef<HTMLDialogElement>(null)
	useEffect(() => {
		if (open) {
			ref.current?.showModal()
		} else {
			ref.current?.close()
		}
	}, [open])
	return (
		<dialog className={styles.drawer} ref={ref} onClose={onClose}>
			<div data-bg onClick={(e) => e.currentTarget.closest<HTMLDialogElement>("dialog")!.close()} />
			<div data-panel>
				<button type="button" onClick={(e) => e.currentTarget.closest<HTMLDialogElement>("dialog")!.close()}>
					Close
				</button>
				{children}
				<form method="dialog">
					<button>OK</button>
				</form>
			</div>
		</dialog>
	)
}

function Tooltip({
	children,
	text,
}: {
	children: ReactElement<{
		"data-trigger"?: string
		style?: CSSProperties
		onMouseEnter?: (e: MouseEvent) => void
		onMouseLeave?: (e: MouseEvent) => void
		onFocus?: (e: FocusEvent) => void
		onBlur?: (e: FocusEvent) => void
	}>
	text?: string
}) {
	const id = useId()
	return (
		<div className={styles.tooltip}>
			{cloneElement(children, {
				["data-trigger"]: "true",
				style: { anchorName: `--${CSS.escape(id)}`, zIndex: 0 },
				onMouseEnter: (e) => ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).showPopover(),
				onMouseLeave: (e) => ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).hidePopover(),
				onFocus: (e) => ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).showPopover(),
				onBlur: (e) => ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).hidePopover(),
			})}
			<div data-content style={{ positionAnchor: `--${CSS.escape(id)}` }} popover="manual">
				{text}
			</div>
		</div>
	)
}

const TOAST_EVENT = "toast"
declare global {
	interface WindowEventMap {
		[TOAST_EVENT]: CustomEvent<ReactNode>
	}
}

type ToastItem = {
	id: string
	content: ReactNode
	clear: () => void
}

function dispatchToast(content: ReactNode) {
	window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: content }))
}

function Toast() {
	const [toasts, setToasts] = useState<ToastItem[]>([])
	const ref = useRef<HTMLDivElement>(null)

	const has = toasts.length > 0
	useEffect(() => {
		if (has) {
			ref.current?.showPopover()
		} else {
			ref.current?.hidePopover()
		}
	}, [has])

	useEffect(() => {
		const onToast = (e: CustomEvent<ReactNode>) => {
			e.stopPropagation()
			const id = Math.random().toString(36).slice(2)
			const clear = () => {
				clearTimeout(timeout)
				const before = new Map(
					Array.from(ref.current!.children).map((child) => [child as HTMLElement, child.getBoundingClientRect().top]),
				)
				flushSync(() => setToasts((toasts) => toasts.filter((toast) => toast.id !== id)))
				for (const [child, beforeTop] of before) {
					if (!child.isConnected) continue
					const afterTop = child.getBoundingClientRect().top
					child.animate([{ transform: `translateY(${beforeTop - afterTop}px)` }, { transform: "translateY(0)" }], {
						duration: 300,
					})
				}
			}
			const timeout = setTimeout(() => clear(), 5000)
			setToasts((toasts) => [...toasts, { id, content: e.detail, clear }])
		}
		window.addEventListener("toast", onToast)
		return () => window.removeEventListener("toast", onToast)
	}, [])

	return (
		<div popover="manual" ref={ref} className={styles.toasts}>
			{toasts.slice(0, 5).map((toast) => (
				<div key={toast.id} className={styles.toast}>
					{toast.content}
					<button type="button" onClick={toast.clear}>
						×
					</button>
				</div>
			))}
		</div>
	)
}
