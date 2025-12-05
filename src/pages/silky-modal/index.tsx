import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { useId, type MouseEvent, type ReactNode } from "react"

import src from "./lorem.jpg"
/* eslint-disable react/no-unknown-property */
import styles from "./styles.module.css"

export const meta: RouteMeta = {
	title: "Silky Modal",
	tags: ["css"],
}

declare module "react" {
	interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
		commandfor?: string
		command?: "show-modal" | "close" | "toggle-popover" | "hide-popover"
	}
}

export default function SilkyModalPage() {
	return (
		<>
			<div className={styles.main}>
				<Head />
			</div>
			<div className={styles.examples}>
				<Second />
				<BottomSheet />
				<SideSheet />
				<HorizontalStartModal />
			</div>
		</>
	)
}

const onClose = (e: MouseEvent) => {
	e.preventDefault()
	const dialog = e.currentTarget.closest<HTMLDialogElement>("dialog")!
	if (dialog.dataset.orientation === "vertical") {
		if (dialog.dataset.align === "start") {
			dialog.scrollTo({ top: dialog.offsetHeight, behavior: "smooth" })
		} else {
			dialog.scrollTo({ top: 0, behavior: "smooth" })
		}
	} else {
		if (dialog.dataset.align === "start") {
			dialog.scrollTo({ left: dialog.offsetWidth, behavior: "smooth" })
		} else {
			dialog.scrollTo({ left: 0, behavior: "smooth" })
		}
	}
}

function Second() {
	const id = useId()

	return (
		<>
			<button commandfor={id} command="show-modal">
				Vertical center sheet
			</button>
			<Dialog id={id} orientation="vertical" align="center" className={styles.verticalCenter}>
				<Content id={id} />
			</Dialog>
		</>
	)
}

function BottomSheet() {
	const id = useId()

	return (
		<>
			<button commandfor={id} command="show-modal">
				Vertical end sheet
			</button>
			<Dialog id={id} orientation="vertical" align="end" className={styles.verticalBottom}>
				<Content id={id} />
			</Dialog>
		</>
	)
}

function SideSheet() {
	const id = useId()

	return (
		<>
			<button commandfor={id} command="show-modal">
				Horizontal end sheet
			</button>
			<Dialog id={id} orientation="horizontal" align="end" className={styles.horizontalEnd}>
				<Content id={id} />
			</Dialog>
		</>
	)
}

function HorizontalStartModal() {
	const id = useId()

	return (
		<>
			<button commandfor={id} command="show-modal">
				Horizontal start sheet
			</button>
			<Dialog id={id} orientation="horizontal" align="start" className={styles.horizontalStart}>
				<Content id={id} />
			</Dialog>
		</>
	)
}

function Dialog({
	id,
	children,
	className,
	orientation = "vertical",
	align = "center",
}: {
	id: string
	children: ReactNode
	className?: string
	orientation?: "horizontal" | "vertical"
	align?: "start" | "center" | "end"
}) {
	return (
		<dialog
			className={styles.dialog}
			id={id}
			data-orientation={orientation}
			data-align={align}
			ref={(e) => {
				if (!e) return
				const observer = new IntersectionObserver(([entry]) => !entry.isIntersecting && e.close(), {
					rootMargin: "-1px",
				})
				const area = e.querySelector<HTMLDivElement>("[data-dialog-area]")!
				const content = area.querySelector<HTMLDivElement>("[data-dialog-content]")!
				observer.observe(content)
				const controller = new AbortController()
				e.addEventListener(
					"beforetoggle",
					(event) => {
						if (event.newState === "open")
							requestAnimationFrame(() => {
								e.scrollTop = area.offsetTop
								e.scrollLeft = area.offsetLeft
								e.querySelector<HTMLDivElement>("[data-dialog-content]")!.scrollTop = 0
							})
					},
					{ signal: controller.signal },
				)
				return () => {
					controller.abort()
					observer.disconnect()
				}
			}}
		>
			<div data-dialog-area onClick={onClose}>
				<div className={className} data-dialog-content onClick={(e) => e.stopPropagation()}>
					{children}
				</div>
			</div>
		</dialog>
	)
}

function Content({ id }: { id: string }) {
	return (
		<div className={styles.content}>
			<button commandfor={id} command="close" onClick={onClose}>
				Close
			</button>
			<img src={src} alt="Random" />
			<div className={styles.body}>
				<p>
					Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce sodales urna iaculis erat ultricies mattis. In
					efficitur varius nulla id lobortis. Nam consequat nibh et ante finibus semper. Donec placerat vehicula
					imperdiet. Morbi sollicitudin sem a odio ullamcorper, ac porta eros hendrerit. Cras pellentesque sem non neque
					malesuada, ac consequat lacus tincidunt. Ut venenatis, nulla non ultrices vulputate, orci ex laoreet lorem, eu
					efficitur libero ligula eget nulla. Mauris et risus mattis, fermentum tortor iaculis, maximus velit. Morbi
					tincidunt lacus a eros hendrerit viverra. Vivamus viverra ex in justo tincidunt aliquam. Nulla non nisi vitae
					sapien lobortis iaculis eget et mi. Duis justo mi, placerat ut vestibulum ac, posuere sit amet mauris.
					Vestibulum id elit purus. Maecenas efficitur maximus ipsum, non condimentum felis cursus et. Nunc tempus
					volutpat nisi. Phasellus porta sapien ex, ac sodales urna feugiat eu.
				</p>
				<p>
					Integer mauris nunc, tincidunt a euismod sed, aliquam nec libero. Vivamus accumsan at justo eget euismod.
					Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Nunc ullamcorper ante
					non tristique porttitor. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia
					curae; Sed quis sem ac sem suscipit mollis at et purus. Nulla non tincidunt elit.
				</p>
				<p>
					Integer dignissim convallis nunc ut lobortis. Donec ac ligula elit. Donec in iaculis nisi. Vestibulum at
					mattis velit. Aenean aliquam orci vel lorem interdum, sed pulvinar sem placerat. Aliquam in blandit libero.
					Vivamus consequat libero nec magna ullamcorper, nec congue nunc sagittis. Vivamus ac sagittis ipsum. Phasellus
					condimentum lorem ac metus tristique, sit amet mattis sapien viverra. Mauris cursus eros vel erat mattis,
					vitae egestas eros placerat. Vestibulum risus nulla, efficitur ac egestas ac, semper id lectus. Duis aliquam
					ac libero non efficitur.
				</p>
				<p>
					Quisque aliquam purus sapien, ut maximus metus fermentum sed. Integer in ipsum sed enim tristique tincidunt.
					Sed maximus luctus lectus, eu sagittis felis eleifend vitae. Vestibulum mattis ipsum velit, at facilisis massa
					tincidunt eu. Phasellus vitae enim ut ante ullamcorper tempor. Donec bibendum posuere lacus, non vestibulum
					sem tristique non. Vestibulum imperdiet mauris nec arcu faucibus, ac pharetra magna maximus. Integer sit amet
					diam porttitor justo aliquet gravida a a libero. Morbi auctor rhoncus congue.
				</p>
				<p>
					Aenean commodo, elit ullamcorper iaculis tincidunt, felis elit placerat lorem, sit amet molestie enim enim at
					magna. Pellentesque ut cursus justo. Aenean condimentum massa pulvinar erat feugiat imperdiet. Fusce id porta
					sapien. Quisque dictum velit vel dui iaculis luctus. Sed rhoncus congue est vel imperdiet. Cras sagittis
					turpis sem, venenatis imperdiet nulla mattis ac. Phasellus viverra lectus eu venenatis hendrerit. Cras dapibus
					nisi eget est ultrices blandit. Fusce nec mattis risus, vel ornare lacus. Pellentesque ac urna sagittis,
					aliquet tortor quis, condimentum mi. Aliquam elit sapien, scelerisque id dolor sit amet, congue elementum
					velit. Mauris leo lorem, tincidunt nec odio non, tempus interdum nulla.
				</p>
			</div>
		</div>
	)
}
