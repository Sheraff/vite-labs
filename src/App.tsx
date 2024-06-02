import { Suspense } from "react"
import { ROUTES, type Routes } from "./router"
import { Link, useNavigation } from "./Navigation"
import styles from './App.module.css'


function App() {

  const route = useNavigation()

  const Component = route ? ROUTES[route].Component : null

  if (Component) return <Suspense><Component /></Suspense>

  const formatter = new Intl.DateTimeFormat('en', {
    dateStyle: 'full',
    timeStyle: 'short'
  })
  return (
    <>
      <h1>hello</h1>
      <hr />
      {Object.entries(ROUTES)
        .sort(([a], [b]) => a.localeCompare(b))
        .sort((a, b) => b[1].git.firstAdded - a[1].git.firstAdded)
        .sort((a, b) => b[1].git.lastModified - a[1].git.lastModified)
        .map(([route, { meta, git }]) => (
          <div key={route} className={styles.route}>
            <Link href={`/${route as Routes}`}>
              <h2 style={{ viewTransitionName: route }} className={styles.link}>{meta.title}</h2>
            </Link>
            <p>Last modified: {git.lastModified && formatter.format(git.lastModified)}</p>
          </div>
        ))
      }
    </>
  )
}

export default App
