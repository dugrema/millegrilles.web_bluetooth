
import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import ErrorBoundary from './ErrorBoundary';

const App = lazy(()=>import('./App'))

const root = createRoot(document.getElementById('root'));
const loading = <Loading />
root.render(
  <StrictMode>
    <Suspense fallback={loading}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Suspense>
  </StrictMode>
);

function Loading(props) {
  return (
    <div>
      <div className="navinit">
        <nav>
          <span>MilleGrilles</span>
        </nav>
      </div>

      <p className="titleinit">Preparation de l'application</p>
      <p>Veuillez patienter durant le chargement de la page.</p>
      <ol>
        <li>Initialisation</li>
        <li>Chargement des composants dynamiques</li>
      </ol>
    </div>
  )
}
