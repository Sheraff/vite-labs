import { Suspense } from "react"
import { ROUTES, type Routes } from "./router"
import { Link, useNavigation } from "./Navigation"
import styles from './App.module.css'


function App() {

  const route = useNavigation()

  const Component = route ? ROUTES[route].Component : null

  if (Component) return <Suspense><Component /></Suspense>

  return (
    <>
      <h1>hello</h1>
      <hr />
      {Object.entries(ROUTES).map(([route, { meta }]) => (
        <div key={route}>
          <Link href={`/${route as Routes}`}>
            <h2 style={{ viewTransitionName: route }} className={styles.link}>{meta.title}</h2>
          </Link>
          <hr />
        </div>
      ))}
    </>
  )
}

export default App
