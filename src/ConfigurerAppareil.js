import {useState, useCallback, useEffect} from 'react'

import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'

import { FormatterDate } from '@dugrema/millegrilles.reactjs'

import { 
    requestDevice, chargerEtatAppareil, transmettreDictChiffre, 
    submitConfiguration as bleSubmitConfiguration, 
    submitWifi as bleSubmitWifi,
} from './bleCommandes'

function ConfigurerAppareil(props) {

    const [devices, setDevices] = useState('')
    const [deviceSelectionne, setDeviceSelectionne] = useState('')
    const [bluetoothServer, setBluetoothServer] = useState('')
    const [authSharedSecret, setAuthSharedSecret] = useState('')

    const [ssid, setSsid] = useState('')
    const [wifiPassword, setWifiPassword] = useState('')
    const [relai, setRelai] = useState('')    

    const workers = null

    const fermerAppareilCb = useCallback(()=>{
        setDeviceSelectionne('')
        setBluetoothServer('')
        setAuthSharedSecret('')
    }, [setDeviceSelectionne, setBluetoothServer, setAuthSharedSecret])

    const scanCb = useCallback(()=>{
        console.debug("Request device")
        requestDevice()
            .then(device=>{
                if(!device) return  // Cancelled

                const devicesCopy = {...devices}
                const deviceId = device.id
                devicesCopy[deviceId] = {name: device.name}
                setBluetoothServer('')  // Toggle deconnexion au besoin
                setDevices(devicesCopy)
                setDeviceSelectionne(device)
            })
            .catch(err=>console.error("Erreur chargement device ", err))
    }, [devices, setDevices, setDeviceSelectionne])

    useEffect(()=>{
        let connexion = null
        if(deviceSelectionne) {
            // Se connecter
            console.debug("Connexion bluetooth a %O", deviceSelectionne)
            deviceSelectionne.gatt.connect()
                .then(server=>{
                    setBluetoothServer(server)
                    connexion = server
                })
                .catch(err=>console.error("Erreur connexion bluetooth", err))

            return () => {
                if(connexion) {
                    console.debug("Deconnexion bluetooth de %O", connexion)
                    connexion.disconnect()
                        // .catch(err=>console.error("Erreur deconnexion bluetooth", err))
                    fermerAppareilCb()
                }
            }                
        }
    }, [deviceSelectionne, setBluetoothServer, fermerAppareilCb])

    if(bluetoothServer) return (
        <div>
            <ConfigurerAppareilSelectionne 
                deviceSelectionne={deviceSelectionne} 
                server={bluetoothServer} 
                ssid={ssid}
                wifiPassword={wifiPassword}
                relai={relai} 
                authSharedSecret={authSharedSecret} 
                fermer={fermerAppareilCb} />
        </div>
    )

    return (
        <div>
            <ValeursConfiguration 
                ssid={ssid}
                setSsid={setSsid}
                wifiPassword={wifiPassword}
                setWifiPassword={setWifiPassword}
                relai={relai}
                setRelai={setRelai} />

            <p>Les boutons suivants permettent de trouver un appareil avec la radio bluetooth.</p>

            <p>
                <Button variant="primary" onClick={scanCb}>Scan</Button>{' '}
                <Button variant="secondary" onClick={fermerAppareilCb} disabled={!deviceSelectionne}>Fermer</Button>
            </p>
        </div>
    )

}

export default ConfigurerAppareil

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

function ConfigurerAppareilSelectionne(props) {
    const { deviceSelectionne, server, ssid, wifiPassword, relai, authSharedSecret, fermer } = props

    const workers = null  // useWorkers()

    const [etatAppareil, setEtatAppareil] = useState('')

    const rafraichir = useCallback(()=>{
        if(!server.connected) {
            console.warn("Connexion bluetooth coupee")
            fermer()
        }
        chargerEtatAppareil(server)
            .then(etat=>{
                console.debug("Etat appareil %O", etat)
                setEtatAppareil(etat)
            })
            .catch(err=>{
                console.debug("Erreur chargement etat appareil ", err)
                fermer()
            })
    }, [server, setEtatAppareil, fermer])

    const rebootCb = useCallback(()=>{
        const commande = { commande: 'reboot' }
        transmettreDictChiffre(workers, server, authSharedSecret, commande)
            .then(()=>{
                console.debug("Commande reboot transmise")
            })
            .catch(err=>console.error("Erreur reboot ", err))
    }, [workers, server, authSharedSecret])

    useEffect(()=>{
        if(server.connected) {
            rafraichir()
            const interval = setInterval(rafraichir, 7_500)
            return () => clearInterval(interval)
        }
    }, [server, rafraichir])

    if(!server) return ''

    return (
        <div>
            <Row>
                <Col xs={9} md={10} lg={11}>
                    <h3>{deviceSelectionne.name}</h3>
                </Col>
                <Col>
                    <br/>
                    <Button variant="secondary" onClick={fermer}>X</Button>
                </Col>
            </Row>

            <EtatAppareil value={etatAppareil} />
            <EtatLectures value={etatAppareil} server={server} authSharedSecret={authSharedSecret} />
            
            <SoumettreConfiguration 
                show={!!etatAppareil}
                server={server} 
                ssid={ssid}
                wifiPassword={wifiPassword}
                relai={relai} />

            <p></p>
            <hr/>
            <Button variant="danger" onClick={rebootCb} disabled={!authSharedSecret}>Reboot</Button>
            <p></p>
            <p></p>
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
        </div>
    )
}

function EtatLectures(props) {
    const { value, server, authSharedSecret } = props

    if(!value) return ''

    return (
        <div>
            <p></p>

            <Row><Col xs={6} sm={4} md={3}>Ntp sync</Col><Col>{value.ntp?'Oui':'Non'}</Col></Row>
            <Row><Col xs={6} sm={4} md={3}>Heure</Col><Col><FormatterDate value={value.time}/></Col></Row>
            <ValeurTemperature value={value.temp1} label='Temperature 1' />
            <ValeurTemperature value={value.temp2} label='Temperature 2' />
            <ValeurHumidite value={value.hum} />
            <SwitchBluetooth value={value.switches[0]} idx={0} label='Switch 1' server={server} authSharedSecret={authSharedSecret} />
            <SwitchBluetooth value={value.switches[1]} idx={1} label='Switch 2' server={server} authSharedSecret={authSharedSecret} />
            <SwitchBluetooth value={value.switches[2]} idx={2} label='Switch 3' server={server} authSharedSecret={authSharedSecret} />
            <SwitchBluetooth value={value.switches[3]} idx={3} label='Switch 4' server={server} authSharedSecret={authSharedSecret} />
        </div>
    )
}

function ValeurTemperature(props) {
    const { value, label } = props

    if(!value) return ''

    return (
        <Row><Col xs={6} sm={4} md={3}>{label||'Temperature'}</Col><Col>{value}&deg;C</Col></Row>
    )
}

function ValeurHumidite(props) {
    const { value, label } = props

    if(!value) return ''

    return (
        <Row><Col xs={6} sm={4} md={3}>{label||'Humidite'}</Col><Col>{value}%</Col></Row>
    )
}

function SwitchBluetooth(props) {
    const { value, label, idx, server, authSharedSecret } = props

    const workers = null  // useWorkers()

    const commandeSwitchCb = useCallback(e=>{
        const { name, value } = e.currentTarget
        const idx = Number.parseInt(name)
        const valeur = value==='1'
        const commande = { commande: 'setSwitchValue', idx, valeur }
        transmettreDictChiffre(workers, server, authSharedSecret, commande)
            .then(()=>{
                console.debug("Commande switch transmise")
            })
            .catch(err=>console.error("Erreur switch BLE : ", err))
    }, [workers, idx, server, authSharedSecret])

    if(!value.present) return ''

    return (
        <Row>
            <Col xs={6} sm={4} md={3}>{label||'Switch'}</Col>
            <Col>{value.valeur?'ON':'OFF'}</Col>
            <Col>
                <Button variant="secondary" name={''+idx} value="1" onClick={commandeSwitchCb} disabled={!authSharedSecret}>ON</Button>{' '}
                <Button variant="secondary" name={''+idx} value="0" onClick={commandeSwitchCb} disabled={!authSharedSecret}>OFF</Button>
            </Col>
        </Row>
    )
}

function ValeursConfiguration(props) {

    const { ssid, setSsid, wifiPassword, setWifiPassword, relai, setRelai } = props

    const usager = {} // useUsager()

    return (
        <div>
            <h3>Configuration des appareils</h3>
            <Row>
                <Col xs={6} md={2}>
                    <Form.Label>Nom Wifi (SSID)</Form.Label>
                </Col>
                <Col xs={6} md={4}>
                    <Form.Control type="text" placeholder="Exemple : Bell1234" value={ssid} onChange={e=>setSsid(e.currentTarget.value)} />
                </Col>
                <Col xs={6} md={2}>
                    <Form.Label>Mot de passe</Form.Label>
                </Col>
                <Col xs={6} md={4}>
                    <Form.Control type="password" value={wifiPassword} onChange={e=>setWifiPassword(e.currentTarget.value)} />
                </Col>
            </Row>

            <p></p>
            <Form.Group controlId="formRelai">
                <Form.Label>URL serveur</Form.Label>
                <Form.Control type="text" placeholder="https://millegrilles.com/senseurspassifs_relai ..." value={relai} onChange={e=>setRelai(e.currentTarget.value)} />
            </Form.Group>
            <p></p>
        </div>
    )
}

function SoumettreConfiguration(props) {

    const { show, server, ssid, wifiPassword, relai, userId, idmg } = props

    const [messageSucces, setMessageSucces] = useState('')
    const [messageErreur, setMessageErreur] = useState('')

    const messageSuccesCb = useCallback(m=>{
        setMessageSucces(m)
        setTimeout(()=>setMessageSucces(''), 5_000)
    }, [setMessageSucces])

    const submitConfigurationServer = useCallback(e=>{
        console.debug("Submit configuration ", e)
        bleSubmitConfiguration()
            .then(()=>{
                console.debug("Configuration submit OK")
            })
            .catch(err=>{
                console.error("Erreur sauvegarde parametres serveur", err)
                setMessageErreur({err, message: 'Les parametres serveur n\'ont pas ete recus par l\'appareil.'})
            })    
    }, [server, idmg, userId, relai, messageSuccesCb, setMessageErreur])

    const submitWifiCb = useCallback(()=>{
        if(!ssid || !wifiPassword) return  // Rien a faire

        bleSubmitWifi(server, ssid, wifiPassword)
            .then(()=>{
                console.debug("Wifi submit OK")
            })
            .catch(err=>{
                console.error("Erreur submit wifi ", err)
                setMessageErreur({err, message: 'Les parametres wifi n\'ont pas ete recus par l\'appareil.'})
            })
    }, [server, ssid, wifiPassword, messageSuccesCb, setMessageErreur])

    if(!show) return ''

    return (
        <div>
            <br/>
            <p>Utilisez les boutons suivants pour modifier la configuration de l'appareil.</p>
            <Alert variant='success' show={!!messageSucces}>
                <Alert.Heading>Succes</Alert.Heading>
                <p>{messageSucces}</p>
            </Alert>
            <Alert variant='danger' show={!!messageErreur}>
                <Alert.Heading>Erreur</Alert.Heading>
                <p>{messageErreur.message}</p>
                <p>{''+messageErreur.err}</p>
            </Alert>
            <Button variant="secondary" onClick={submitWifiCb} disabled={!ssid||!wifiPassword}>Changer wifi</Button>{' '}
            <Button variant="secondary" onClick={submitConfigurationServer} disabled={!userId || !idmg || !relai}>Configurer serveur</Button>
            <p></p>
        </div>
    )
}
