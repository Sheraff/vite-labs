/// <reference lib="webworker" />

const s = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self))

s.addEventListener("install", (event) => event.waitUntil(s.skipWaiting()))
s.addEventListener("activate", (event) => event.waitUntil(s.clients.claim()))

s.addEventListener("fetch", (event) => {
	if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") return
	if (!event.request.url.endsWith("/") && !event.request.url.endsWith(".js")) return

	event.respondWith(
		fetch(event.request).then((response) => {
			if (response.status === 0) {
				return response
			}
			const newHeaders = new Headers(response.headers)
			newHeaders.set("Cross-Origin-Opener-Policy", "same-origin")
			newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp")

			const moddedResponse = new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: newHeaders,
			})

			return moddedResponse
		}),
	)
})
