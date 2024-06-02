import { Suspense } from "react"
import { ROUTES } from "./router"
import { useNavigation } from "./Navigation"


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
          <a href={`${import.meta.env.BASE_URL}${route}`}><h2>{meta.title}</h2></a>
          <hr />
        </div>
      ))}
    </>
  )
}

export default App
