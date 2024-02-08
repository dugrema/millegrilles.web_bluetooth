import {useState, useCallback, useEffect} from 'react'

import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'

import millegrillesServicesConst from './services.json'

import { FormatterDate } from '@dugrema/millegrilles.reactjs'

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
                    <p>Utiliser Chrome ou Chromium lorsque possible.</p>
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

    const {devices, setDevices, deviceSelectionne, setDeviceSelectionne} = props

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
        console.debug("Refresh devices")
        if('getDevices' in bluetooth) {
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
        }
    }, [setDevices])

    useEffect(()=>{
        // Charger devices
        refreshDevices()
        // const refreshInterval = setInterval(refreshDevices, 5_000)
        // return () => {
        //     // Cleanup interval
        //     clearInterval(refreshInterval)
        // }
    }, [refreshDevices])

    const scanCb = useCallback(()=>{
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
    }, [devices, setDevices, setDeviceSelectionne])

    return (
        <div>
            <p>Appareils connus</p>

            <ListeAppareil devices={devices} selectionnerDevice={selectionnerDevice} />

            <p></p>
            <p>
                <Button variant="primary" onClick={scanCb}>Scan</Button>
            </p>

            <ConfigurerAppareilSelectionne deviceSelectionne={deviceSelectionne} fermer={()=>setDeviceSelectionne('')} />

        </div>
    )
}

function sortDevices(a, b) {
    if(a === b) {} 
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
            // filters: [{services: [etatUuid]}],
            filters: [{services: [configurerUuid]}],
            // Optionnels - requis par Chrome sur Windows (permission d'acces)
            // optionalServices: [configurerUuid, environmentalUuid],
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

function ConfigurerAppareilSelectionne(props) {
    const { deviceSelectionne, fermer } = props

    const [etatAppareil, setEtatAppareil] = useState('')

    const rafraichir = useCallback(()=>{
        chargerEtatAppareil(deviceSelectionne)
            .then(etat=>{
                console.debug("Etat appareil %O", etat)
                setEtatAppareil(etat)
            })
            .catch(err=>console.debug("Erreur chargement etat appareil ", err))
    }, [deviceSelectionne, setEtatAppareil])

    useEffect(rafraichir, [rafraichir])

    if(!deviceSelectionne) return ''

    return (
        <div>
            <hr />
            <h3>Configurer {deviceSelectionne.name}</h3>

            <EtatAppareil value={etatAppareil} />
            
            <p></p>
            <Button variant="secondary" onClick={rafraichir}>Rafraichir</Button>
            <Button variant="secondary" onClick={fermer}>Fermer</Button>
            <p></p>

            {etatAppareil?
                <ValeursConfiguration device={deviceSelectionne} value={etatAppareil} />
            :''}
        </div>
    )
}

function EtatAppareil(props) {
    const { value } = props

    if(!value) return ''

    return (
        <div>
            <Row><Col xs={12} md={3}>Idmg</Col><Col>{value.idmg}</Col></Row>
            <Row><Col xs={12} md={3}>User id</Col><Col>{value.userId}</Col></Row>

            <Row><Col xs={6} sm={4} md={3}>WIFI SSID</Col><Col>{value.ssid}</Col></Row>
            <Row><Col xs={6} sm={4} md={3}>WIFI ip</Col><Col>{value.ip}</Col></Row>
            <Row><Col xs={6} sm={4} md={3}>WIFI subnet</Col><Col>{value.subnet}</Col></Row>
            <Row><Col xs={6} sm={4} md={3}>WIFI gateway</Col><Col>{value.gateway}</Col></Row>
            <Row><Col xs={6} sm={4} md={3}>WIFI dns</Col><Col>{value.dns}</Col></Row>

            <Row><Col xs={6} sm={4} md={3}>Ntp sync</Col><Col>{value.ntp?'Oui':'Non'}</Col></Row>
            <Row><Col xs={6} sm={4} md={3}>Heure</Col><Col><FormatterDate value={value.time}/></Col></Row>
        </div>
    )
}

async function chargerEtatAppareil(device) {
    try {
        const server = await device.gatt.connect()
        if(!server.connected) {
            console.error("GATT connexion - echec")
            return
        }
        const service = await server.getPrimaryService(millegrillesServicesConst.services.etat.uuid)
        console.debug("Service : ", service)
        const characteristics = await service.getCharacteristics()
        const etat = await lireEtatCharacteristics(characteristics)

        try {
            await server.disconnect()
        } catch(err) {
            console.warn("Erreur deconnexion %O", err)
        }

        return etat
    } catch(err) {
        console.error("Erreur chargerEtatAppareil %O", err)
    }
}

async function lireEtatCharacteristics(characteristics) {
    console.debug("Nombre characteristics : " + characteristics.length)
    const etat = {}
    for await(const characteristic of characteristics) {
        console.debug("Lire characteristic " + characteristic.uuid)
        const uuidLowercase = characteristic.uuid.toLowerCase()
        switch(uuidLowercase) {
            case millegrillesServicesConst.services.etat.characteristics.getUserId:
                etat.userId = await readTextValue(characteristic)
                break
            case millegrillesServicesConst.services.etat.characteristics.getIdmg:
                etat.idmg = await readTextValue(characteristic)
                break
            case millegrillesServicesConst.services.etat.characteristics.getWifi1:
                Object.assign(etat, await readWifi1(characteristic))
                break
            case millegrillesServicesConst.services.etat.characteristics.getWifi2:
                etat.ssid = await readTextValue(characteristic)
                break
            case millegrillesServicesConst.services.etat.characteristics.getTime:
                Object.assign(etat, await readTime(characteristic))
                break
            default:
                console.debug("Characteristic etat inconnue : " + characteristic.uuid)
        }
    }
    return etat
}

async function readTextValue(characteristic) {
    const value = await characteristic.readValue()
    return new TextDecoder().decode(value)
}

async function readTime(characteristic) {
    const value = await characteristic.readValue()
    console.debug("readTime value %O", value)
    const etatNtp = value.getUint8(0) === 1
    const timeSliceVal = new Uint32Array(value.buffer.slice(1, 5))
    console.debug("Time slice val ", timeSliceVal)
    const timeVal = timeSliceVal[0]
    const dateTime = new Date(timeVal * 1000)
    console.debug("Time val : %O, Date %O", timeVal, dateTime)
    return {ntp: etatNtp, time: timeVal}
}

function convertirBytesIp(adresse) {
    let adresseStr = adresse.join('.')
    return adresseStr
}

async function readWifi1(characteristic) {
    const value = await characteristic.readValue()
    console.debug("readWifi1 value %O", value)
    const connected = value.getUint8(0) === 1,
          status = value.getUint8(1),
          channel = value.getUint8(2)
    const adressesSlice = value.buffer.slice(3, 19)
    const adressesList = new Uint8Array(adressesSlice)
    const ip = convertirBytesIp(adressesList.slice(0, 4))
    const subnet = convertirBytesIp(adressesList.slice(4, 8))
    const gateway = convertirBytesIp(adressesList.slice(8, 12))
    const dns = convertirBytesIp(adressesList.slice(12, 16))

    const etatWifi = {
        connected,
        status,
        channel,
        ip, subnet, gateway, dns
    }

    return etatWifi
}

function ValeursConfiguration(props) {

    const { device, value } = props

    const [idmg, setIdmg] = useState(value.idmg)
    const [userId, setUserId] = useState(value.userId)
    const [ssid, setSsid] = useState(value.ssid)
    const [wifiPassword, setWifiPassword] = useState('')
    const [relai, setRelai] = useState('')    

    const submitUsager = useCallback(e=>{
        console.debug("Submit usager ", e)
        e.stopPropagation()
        e.preventDefault()

        const cb = async characteristic => {
            const params = {commande: 'setUser', idmg, user_id: userId}
            await transmettreDict(characteristic, params)
        }
        
        const configurerUuid = millegrillesServicesConst.services.configurer.uuid,
              setConfigUuid = millegrillesServicesConst.services.configurer.characteristics.setConfig

        submitParamAppareil(device, configurerUuid, setConfigUuid, cb).then(()=>{
            console.debug("Params user envoyes")
        })
        .catch(err=>console.error("Erreur submit user ", err))
    }, [device, idmg, userId])

    const submitWifi = useCallback(e=>{
        console.debug("Submit wifi ", e)
        e.stopPropagation()
        e.preventDefault()

        const cb = async characteristic => {
            const params = {commande: 'setWifi', ssid, password: wifiPassword}
            await transmettreDict(characteristic, params)
        }

        const configurerUuid = millegrillesServicesConst.services.configurer.uuid,
              setConfigUuid = millegrillesServicesConst.services.configurer.characteristics.setConfig

        submitParamAppareil(device, configurerUuid, setConfigUuid, cb).then(()=>{
            console.debug("Params wifi envoyes")
        })
        .catch(err=>console.error("Erreur submit wifi ", err))

    }, [device, ssid, wifiPassword])

    const submitRelai = useCallback(e=>{
        console.debug("Submit relai ", e)
        e.stopPropagation()
        e.preventDefault()

        const params = {commande: 'setRelai', relai}

        const cb = async characteristic => {
            await transmettreDict(characteristic, params)
        }
        
        const configurerUuid = millegrillesServicesConst.services.configurer.uuid,
              setConfigUuid = millegrillesServicesConst.services.configurer.characteristics.setConfig

        submitParamAppareil(device, configurerUuid, setConfigUuid, cb).then(()=>{
            console.debug("Params relai envoyes")
        })
        .catch(err=>console.error("Erreur submit relai ", err))
    }, [device, relai])

    return (
        <div>
            <h3>Parametres usager</h3>
            <p>
                Obtenir ces parametres a partir de la section <strong>Configuration / Fichier</strong> de
                l'application SenseursPassifs de MilleGrilles.
            </p>
            <Form onSubmit={submitUsager}>
                <Form.Group controlId="formUserid">
                    <Form.Label>User Id</Form.Label>
                    <Form.Control type="text" placeholder="zABCD01234..." value={userId} onChange={e=>setUserId(e.currentTarget.value)} />
                </Form.Group>
                <Form.Group controlId="formIdmg">
                    <Form.Label>IDMG</Form.Label>
                    <Form.Control type="text" placeholder="zABCD01234..." value={idmg} onChange={e=>setIdmg(e.currentTarget.value)} />
                    <Form.Text className="text-muted">
                        Optionnel si deja configure.
                    </Form.Text>
                </Form.Group>
                <Button variant="secondary" type="submit">Appliquer</Button>
            </Form>

            <h3>Wifi</h3>
            <Form onSubmit={submitWifi}>
                <Form.Group controlId="formSsid">
                    <Form.Label>SSID</Form.Label>
                    <Form.Control type="text" placeholder="Bell1234..." value={ssid} onChange={e=>setSsid(e.currentTarget.value)} />
                </Form.Group>
                <Form.Group controlId="formWifiPassword">
                    <Form.Label>Wifi password</Form.Label>
                    <Form.Control type="password" value={wifiPassword} onChange={e=>setWifiPassword(e.currentTarget.value)} />
                </Form.Group>
                <Button variant="secondary" type="submit">Appliquer</Button>
            </Form>

            <h3>Connexion serveur</h3>
            <Form onSubmit={submitRelai}>
                <Form.Group controlId="formRelai">
                    <Form.Label>Serveur relai</Form.Label>
                    <Form.Control type="text" placeholder="https://millegrilles.com/senseurspassifs_relai ..." value={relai} onChange={e=>setRelai(e.currentTarget.value)} />
                </Form.Group>
                <Button variant="secondary" type="submit">Appliquer</Button>
            </Form>

            <p></p>
        </div>
    )
}

async function transmettreString(characteristic, valeur) {
    const CONST_FIN = new Uint8Array(1)
    CONST_FIN.set(0, 0x0)

    let valeurArray = new TextEncoder().encode(valeur)

    while(valeurArray.length > 0) {
        let valSlice = valeurArray.slice(0, 20)
        valeurArray = valeurArray.slice(20)
        await characteristic.writeValueWithResponse(valSlice)
    }

    // Envoyer char 0x0
    await characteristic.writeValueWithResponse(CONST_FIN)
}

async function transmettreDict(characteristic, valeur) {
    return transmettreString(characteristic, JSON.stringify(valeur))
}

async function submitParamAppareil(device, serviceUuid, characteristicUuid, callback) {
    if(!device) throw new Error("Device manquant")
    if(!serviceUuid) throw new Error('serviceUuid vide')
    if(!characteristicUuid) throw new Error('characteristicUuid vide')

    console.debug("submitParamAppareil serviceUuid %s, characteristicUuid %s", serviceUuid, characteristicUuid)

    try {
        const server = await device.gatt.connect()
        if(!server.connected) {
            console.error("GATT connexion - echec")
            return
        }
        console.debug("GATT server ", server)
        const service = await server.getPrimaryService(serviceUuid)
        console.debug("GATT service ", service)
        const characteristics = await service.getCharacteristics()
        console.debug("GATT service characteristics ", characteristics)

        let traite = false
        for(const characteristic of characteristics) {
            const uuidLowercase = characteristic.uuid.toLowerCase()
            if(uuidLowercase === characteristicUuid) {
                await callback(characteristic)
                traite = true
                break
            }
        }

        try {
            await server.disconnect()
        } catch(err) {
            console.warn("Erreur deconnexion %O", err)
        }

        if(!traite) {
            throw new Error(`characteristic ${characteristicUuid} inconnue pour service ${serviceUuid}`)
        }

    } catch(err) {
        console.error("Erreur chargerEtatAppareil %O", err)
    }
}
