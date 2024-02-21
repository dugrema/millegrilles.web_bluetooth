import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react'
import { setupWorkers, cleanupWorkers } from './workers/workerLoader'

// const CONST_INTERVAL_VERIF_SESSION = 600_000
const CONST_INTERVAL_VERIF_SESSION = 300_000

const Context = createContext()

const { workerInstances, workers: _workers, ready } = setupWorkers()

// Hooks
function useWorkers() {
    // return useContext(Context).workers
    return _workers
}
export default useWorkers

// Provider
export function WorkerProvider(props) {

    // const [workers, setWorkers] = useState('')
    const [workersPrets, setWorkersPrets] = useState(false)

    const value = useMemo(()=>{
        if(workersPrets) return {}
    }, [workersPrets])

    useEffect(()=>{
        // console.info("Initialiser web workers (ready : %O, workers : %O)", ready, _workers)

        // Initialiser workers et tables collections dans IDB
        Promise.all([ready])
            .then(()=>{
                console.info("Workers prets")
                setWorkersPrets(true)
            })
            .catch(err=>console.error("Erreur initialisation workers ", err))

        // Cleanup
        // return () => { 
        //     console.info("Cleanup web workers")
        //     cleanupWorkers(workerInstances) 
        // }
    }, [setWorkersPrets])

    if(!workersPrets) return props.attente

    return <Context.Provider value={value}>{props.children}</Context.Provider>
}

export function WorkerContext(props) {
    return <Context.Consumer>{props.children}</Context.Consumer>
}
