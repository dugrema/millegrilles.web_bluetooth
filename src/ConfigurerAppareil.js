import {useState, useCallback, useEffect} from 'react'

import Button from 'react-bootstrap/Button'

function ConfigurerAppareil(props) {
    return (
        <div>
            <AppareilsPaired />
        </div>
    )
}

export default ConfigurerAppareil

function AppareilsPaired(props) {

    const ajouterCb = useCallback(()=>{
        console.debug("Request device")
    }, [])

    return (
        <div>
            <p>Appareils connus</p>

            <p><Button variant="secondary" onClick={ajouterCb}>Ajouter</Button></p>
        </div>
    )
}
