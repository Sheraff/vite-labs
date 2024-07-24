import ReactDOM from 'react-dom/client'
import App from './App'
import { NavigationProvider } from '~/file-router/Navigation'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <NavigationProvider>
    <App />
  </NavigationProvider>,
)
