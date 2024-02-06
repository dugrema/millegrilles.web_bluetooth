import {useState, useCallback, useEffect} from 'react'

import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

import millegrillesServicesConst from './services.json'

const bluetoothSupporte = 'bluetooth' in navigator
const bluetooth = navigator.bluetooth

function ConfigurerAppareil(props) {

    const [devices, setDevices] = useState('')
    const [deviceSelectionne, setDeviceSelectionne] = useState('')

    if(!bluetoothSupporte) {
        return (
            <div>
                <Alert variant='warning'>
                    <Alert.Heading>Non supporte</Alert.Heading>
                    <p>Bluetooth non supporte sur ce navigateur.</p>
                    <p>Sur iOS, utiliser le navigateur <a href="https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055">Bluefy</a>.</p>
                </Alert>
            </div>
        )
    }

    return (
        <div>
            <AppareilsPaired 
                devices={devices} 
                setDevices={setDevices}
                deviceSelectionne={deviceSelectionne} 
                setDeviceSelectionne={setDeviceSelectionne} />
        </div>
    )
}

export default ConfigurerAppareil

function AppareilsPaired(props) {

    const {devices, setDevices, setDeviceSelectionne} = props

    const selectionnerDevice = useCallback(deviceId=>{
        console.debug("Selectioner device %s", deviceId)
        bluetooth.getDevices()
            .then(devices=>{
                for(const device of devices) {
                    if(device.id === deviceId) {
                        console.debug("Device trouve ", device)
                        setDeviceSelectionne(device)
                        return
                    }
                }
                console.error("Device Id %s inconnu", deviceId)
            })
            .catch(err=>console.error("Erreur getDevices", err))
    }, [setDeviceSelectionne])

    const refreshDevices = useCallback(()=>{
        bluetooth.getDevices()
        .then(devices=>{
            const deviceCopy = devices.reduce((acc, item)=>{
                acc[item.id] = {name: item.name}
                return acc
            }, {})
            console.debug("Devices deja paires : %O", devices)
            setDevices(deviceCopy)
        })
        .catch(err=>console.error("Erreur chargement devices deja paires ", err))
    }, [setDevices])

    useEffect(()=>{
        // Charger devices
        refreshDevices()
    }, [refreshDevices])

    const ajouterCb = useCallback(()=>{
        console.debug("Request device")
        requestDevice()
            .then(device=>{
                const devicesCopy = {...devices}
                const deviceId = device.id
                devicesCopy[deviceId] = {name: device.name}
                setDevices(devicesCopy)
                setDeviceSelectionne(device)
            })
            .catch(err=>console.error("Erreur chargement device ", err))
    }, [devices, setDevices])

    return (
        <div>
            <p>Appareils connus</p>

            <ListeAppareil devices={devices} selectionnerDevice={selectionnerDevice} />

            <p></p>

            <p><Button variant="secondary" onClick={ajouterCb}>Ajouter</Button></p>
        </div>
    )
}

function sortDevices(a, b) {
    if(a == b) {} 
    else if(!a) return 1
    else if(!b) return -1
    
    let comp = a.name.localeCompare(b.name)
    if(comp !== 0) return comp

    return a.id.localeCompare(b.id)
}

function ListeAppareil(props) {
    const { devices, selectionnerDevice } = props

    const selectionnerDeviceCb = useCallback(e=>{
        const value = e.currentTarget.value
        selectionnerDevice(value)
    }, [selectionnerDevice])

    if(!devices) return ''

    const listeDevices = []
    for(const deviceId of Object.keys(devices)) {
        const device = devices[deviceId]
        listeDevices.push({id: deviceId, name: device.name})
    }
    listeDevices.sort(sortDevices)

    return listeDevices.map(item=>{
        return (
            <Row key={item.id}>
                <Col>{item.name||item.id}</Col>
                <Col><Button variant="secondary" value={item.id} onClick={selectionnerDeviceCb}>Configurer</Button></Col>
            </Row>
        )
    })
}

async function requestDevice() {
    let device = null
    const configurerUuid = millegrillesServicesConst.services.configurer.uuid,
          etatUuid  = millegrillesServicesConst.services.etat.uuid,
          environmentalUuid = 0x181a
    console.debug("Services %s, %s", configurerUuid, etatUuid)
    try {
        device = await bluetooth.requestDevice({
            // Requis : service de configuration
            filters: [{services: [configurerUuid]}],
            // Optionnels - requis par Chrome sur Windows (permission d'acces)
            optionalServices: [etatUuid, environmentalUuid],
        })
    } catch(err) {
        if(err.code === 8) {
            // Cancel
            return
        }
        // Reessayer sans optionalServices (pour navigateur bluefy)
        device = await bluetooth.requestDevice({
            // Requis : service de configuration
            filters: [{services: [configurerUuid, etatUuid]}],
        })
    }
    console.debug("Device choisi ", device)
    return device
}
