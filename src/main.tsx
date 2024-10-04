import ReactDOM from 'react-dom/client'
import App from './App'
import { NavigationProvider } from '~/file-router/Navigation'

if (!window.isSecureContext) {
  console.log("Not registering service worker because the site is not hosted on HTTPS.")
} else {
  console.log("Registering service worker", import.meta.env.BASE_URL + 'sw.js')
  await navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
    .then(registration => {
      console.log(`Service worker registered: scope "${registration.scope}"`)
      registration.addEventListener("updatefound", () => window.location.reload())
      const installing = registration.installing
      if (installing) {
        installing.addEventListener("statechange", () => {
          console.log(`Service worker ${installing.state}`)
          if (installing.state === "activated") {
            window.location.reload()
          }
        })
      }
    })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <NavigationProvider>
    <App />
  </NavigationProvider>,
)
