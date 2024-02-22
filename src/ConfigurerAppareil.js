import {useState, useCallback, useEffect, useMemo} from 'react'

import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Form from 'react-bootstrap/Form'

import { pki } from '@dugrema/node-forge'
import { encoderIdmg } from '@dugrema/millegrilles.utiljs/src/idmg'
import { extraireExtensionsMillegrille } from '@dugrema/millegrilles.utiljs/src/forgecommon'
import { FormatterDate, FormatterDuree } from '@dugrema/millegrilles.reactjs'

import { 
    requestDevice, chargerEtatAppareil, transmettreDictChiffre, 
    submitConfiguration as bleSubmitConfiguration, 
    submitWifi as bleSubmitWifi,
    authentifier as bleAuthentifier,
} from './bleCommandes'

import useWorkers from './WorkerContext'

function ConfigurerAppareil(props) {

    const [devices, setDevices] = useState('')
    const [deviceSelectionne, setDeviceSelectionne] = useState('')
    const [bluetoothServer, setBluetoothServer] = useState('')
    const [authSharedSecret, setAuthSharedSecret] = useState('')
    const [authMessage, setAuthMessage] = useState('')
    const [authPrivateKey, setAuthPrivateKey] = useState('')

    const [userId, setUserId] = useState('')
    const [idmg, setIdmg] = useState('')
    const [ssid, setSsid] = useState('')
    const [wifiPassword, setWifiPassword] = useState('')
    const [relai, setRelai] = useState('')    

    const fermerAppareilCb = useCallback(()=>{
        setDeviceSelectionne('')
        setBluetoothServer('')
        setAuthSharedSecret('')
    }, [setDeviceSelectionne, setBluetoothServer, setAuthSharedSecret])

    const processAuthMessage = useCallback(async message=>{
        console.debug("ProcessAuthMessage ", message)
        if(!message) {
            // Reset
            setAuthMessage('')
            setAuthPrivateKey('')
            return
        }

        const privateKey = Buffer.from(message.attachements.privateKey, 'hex')
        console.debug("Private key : %O", privateKey)
        const caPem = message.millegrille

        const idmg = await encoderIdmg(caPem)
        const certForge = pki.certificateFromPem(message.certificat[0])
        const extensions = extraireExtensionsMillegrille(certForge)
        console.debug("IDMG : %O, Extensions : %O", idmg, extensions)
        const userId = extensions.userId

        const contenu = JSON.parse(message.contenu)
        const relai = contenu.relai

        // Retirer millegrille, attachements
        const messageNettoye = {...message, millegrille: undefined, attachements: undefined}

        // Set valeurs auth
        setRelai(relai)
        setAuthMessage(messageNettoye)
        setAuthPrivateKey(privateKey)
        setIdmg(idmg)
        setUserId(userId)
    }, [setAuthMessage, setAuthPrivateKey, setRelai, setUserId, setIdmg])

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

    const authentifierHandler = useCallback(()=>{
        setAuthSharedSecret('')
        bleAuthentifier(bluetoothServer, authPrivateKey, authMessage)
            .then(result=>{
                console.debug("Shared key : ", result)
                if(result && result.sharedSecret) {
                    setAuthSharedSecret(result.sharedSecret)
                } else {
                    setAuthSharedSecret(false)
                }
            })
            .catch(err=>{
                console.error("Erreur BLE authentifier ", err)
                setAuthSharedSecret(false)
            })
    }, [bluetoothServer, authMessage, authPrivateKey, setAuthSharedSecret])

    useEffect(()=>{
        if(bluetoothServer && bluetoothServer.connected && authMessage && authPrivateKey) {
            authentifierHandler()
        }
    }, [bluetoothServer, authMessage, authPrivateKey, setAuthSharedSecret])

    if(bluetoothServer) return (
        <div>
            <ConfigurerAppareilSelectionne 
                deviceSelectionne={deviceSelectionne} 
                server={bluetoothServer} 
                idmg={idmg}
                userId={userId}
                ssid={ssid}
                wifiPassword={wifiPassword}
                relai={relai} 
                authMessage={authMessage}
                authSharedSecret={authSharedSecret} 
                authentifier={authentifierHandler}
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

            <RecevoirAuthentification 
                authActive={!!authPrivateKey && !!authMessage} 
                authMessage={authMessage} 
                setAuthMessage={processAuthMessage} />

            {/* <p>Les boutons suivants permettent de trouver un appareil avec la radio bluetooth.</p> */}

            <p></p>
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
    const { deviceSelectionne, server, idmg, userId, ssid, wifiPassword, relai, authMessage, authSharedSecret, authentifier, fermer } = props

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

            <AttenteConnexion show={!etatAppareil} />

            <EtatAppareil value={etatAppareil} />

            <AuthentifierAppareil 
                show={!!etatAppareil} 
                authSharedSecret={authSharedSecret} 
                authMessage={authMessage} 
                authentifier={authentifier} />

            <EtatLectures value={etatAppareil} server={server} authSharedSecret={authSharedSecret} />
            
            <SoumettreConfiguration 
                show={!!etatAppareil}
                server={server} 
                idmg={idmg}
                userId={userId}
                ssid={ssid}
                wifiPassword={wifiPassword}
                relai={relai} />

            <p></p>
            <BoutonsAdmin show={!!etatAppareil} server={server} authSharedSecret={authSharedSecret} />
            <p></p>
            <p></p>
        </div>
    )
}

function AttenteConnexion(props) {
    const { show } = props

    if(!show) return ''

    return (
        <div>
            <p>Connexion en cours <i className="fa fa-spinner fa-spin"/></p>
        </div>
    )
}

function BoutonsAdmin(props) {

    const { show, server, authSharedSecret } = props

    const workers = useWorkers()

    const rebootCb = useCallback(()=>{
        const commande = { commande: 'reboot' }
        transmettreDictChiffre(workers, server, authSharedSecret, commande)
            .then(()=>{
                console.debug("Commande reboot transmise")
            })
            .catch(err=>console.error("Erreur reboot ", err))
    }, [workers, server, authSharedSecret])

    if(!show) return ''

    return (
        <div>
            <hr/>
            <Button variant="danger" onClick={rebootCb} disabled={!authSharedSecret}>Reboot</Button>
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

    const workers = useWorkers()

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

function RecevoirAuthentification(props) {

    const { authActive, authMessage, setAuthMessage } = props

    const [invalide, setInvalide] = useState(false)

    const workers = useWorkers()

    const dateExpiration = useMemo(()=>{
        if(!authMessage) return ''
        const contenu = JSON.parse(authMessage.contenu)
        return contenu.exp
    }, [authMessage])

    const variantButton = useMemo(()=>{
        if(authActive) return 'success'
        if(invalide) return 'danger'
        return 'secondary'
    }, [authActive, invalide])

    useEffect(()=>{ 
        if(invalide) {
            setAuthMessage('').catch(err=>console.error("Erreur setAuthMessage ", err))
        }
    }, [invalide, setAuthMessage])

    const parseAuthentification = useCallback(async params => {
        const contenu = JSON.parse(params.contenu)
        const expiration = contenu.exp * 1000   // convertir en ms
        if(new Date().getTime() < expiration) {
            const resultatVerification = await workers.chiffrage.verifierMessage(params, {support_idmg_tiers: true})
            console.debug("Resultat verification message : ", resultatVerification)
            if(resultatVerification) {
                setAuthMessage(params)
                window.localStorage.setItem('authToken', JSON.stringify(params))
                setInvalide(false)
            } else {
                setInvalide(true)
            }
        } else {
            setInvalide(true)
        }
    }, [workers, setAuthMessage, setInvalide])

    const authentifierCb = useCallback(()=>{
        console.debug("Params Authentification")
        navigator.clipboard.readText()
            .then(async val => {
                console.debug("Clipboard value : %O", val)
                if(typeof(val) === 'string') {
                    const params = JSON.parse(val)
                    await parseAuthentification(params)
                } else {
                    console.warn("Clipboard mauvais type")
                    setInvalide(true)
                }
            })
            .catch(err=>{
                console.error("Erreur lecture clipboard : ", err)
                setInvalide(true)
            })
    }, [parseAuthentification, setInvalide])

    useEffect(()=>{
        const configurationSauvegardee = window.localStorage.getItem('authToken')
        if(configurationSauvegardee) {
            const configJson = JSON.parse(configurationSauvegardee)
            const contenu = JSON.parse(configJson.contenu)
            const expiration = contenu.exp * 1000  // Convertir en ms
            if(new Date().getTime() < expiration) {
                parseAuthentification(configJson)
                    .catch(err=>console.error("Erreur authentifier localStorage", err))
            }
        }
    }, [parseAuthentification])

    return (
        <div>
            {/* <p>Authentification</p>
            <p>
                L'authentification est optionnelle. Ell permet d'utiliser les actions (ON, OFF, reboot, etc) sur l'appareil.
            </p>
            <p>
                Utiliser SenseursPassifs pour copier l'information d'authentification en memoire (clipboard). 
                Revenir sur cette page et cliquer sur le bouton Verifier pour conserver l'information de connexion aux appareils.
            </p> */}
            <Row>
                <Col xs={12} sm={3} md={2}>
                    <Button variant={variantButton} onClick={authentifierCb} disabled={!navigator.clipboard}>Authentifier</Button>
                </Col>
                <Col><DateExpiration value={dateExpiration} /></Col>
            </Row>
        </div>
    )
}

function DateExpiration(props) {
    const {value} = props

    const [dureeRestante, setDureeRestante] = useState('')

    const calculerDuree = useCallback(()=>{
        const dureeRestante = value - (new Date().getTime() / 1000)
        setDureeRestante(dureeRestante)
    }, [value, setDureeRestante])

    const dateExpiration = useMemo(()=>{
        if(!value) return ''
        const dateExp = new Date(value*1000) + ''
        return dateExp
    }, [value])

    useEffect(()=>{
        calculerDuree()
        const interval = setInterval(calculerDuree, 1000)
        return () => clearInterval(interval)
    }, [calculerDuree])

    if(!value) return ''

    return (
        <div>
            <Row>
                <Col xs={5} md={3} xl={2}>Duree restante</Col><Col><FormatterDuree value={dureeRestante}/></Col>
            </Row>
            <Row>
                <Col xs={5} md={3} xl={2}>Date expiration</Col><Col>{dateExpiration}</Col>
            </Row>
        </div>
    )
}

function AuthentifierAppareil(props) {

    const { show, authSharedSecret, authMessage, authentifier } = props

    const messageEtat = useMemo(()=>{
        if(!authMessage) return <span>Non disponible (doit etre activee sur la page precedente).</span>
        if(authSharedSecret === '') return <span>En cours <i className="fa fa-spinner fa-spin"/></span>
        if(authSharedSecret === false) return (
            <span>Echec <Button variant="secondary" onClick={authentifier}>Ressayer</Button></span>
        )
        if(authSharedSecret) return <span>OK</span>
        return <span>Erreur</span>
    }, [authSharedSecret, authMessage, authentifier])

    if(!show) return ''

    return (
        <Row>
            <Col xs={12} md={3}>Authentification</Col>
            <Col>{messageEtat}</Col>
        </Row>
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
        if(!relai || !idmg || !userId) return  // Rien a faire
        bleSubmitConfiguration(server, relai, idmg, userId)
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
