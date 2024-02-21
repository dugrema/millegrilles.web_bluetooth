import { wrap, releaseProxy } from 'comlink'

// Exemple de loader pour web workers
export function setupWorkers() {

  // Chiffrage et x509 sont combines, reduit taille de l'application
  const chiffrage = wrapWorker(new Worker(new URL('./chiffrage.worker', import.meta.url), {type: 'module'}))

  const workerInstances = { chiffrage }

  const workers = Object.keys(workerInstances).reduce((acc, item)=>{
    acc[item] = workerInstances[item].proxy
    return acc
  }, {})
  
  return { workerInstances, workers, ready: true }
}

function wrapWorker(worker) {
  const proxy = wrap(worker)
  return {proxy, worker}
}

export function cleanupWorkers(workers) {
  Object.values(workers).forEach((workerInstance) => {
    try {
      const {worker, proxy} = workerInstance
      proxy[releaseProxy]()
      worker.terminate()
    } catch(err) {
      console.warn("Errreur fermeture worker : %O\n(Workers: %O)", err, workers)
    }
  })
}
