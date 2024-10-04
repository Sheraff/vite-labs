const controlling = navigator.serviceWorker && navigator.serviceWorker.controller
if (!window.isSecureContext) {
	console.log("Not registering service worker because the site is not hosted on HTTPS.")
} else {
	navigator.serviceWorker.register('./sw.js')
		.then(registration => {
			console.log(`Service worker registered: scope "${registration.scope}"`)
			registration.addEventListener("updatefound", () => window.location.reload())
			if (registration.active && !navigator.serviceWorker.controller) {
				window.location.reload()
			}
		})
}