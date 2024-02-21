import millegrillesServicesConst from './services.json'
import { genererKeyPairX25519, calculerSharedKey } from '@dugrema/millegrilles.utiljs/src/chiffrage.x25519'
import { MESSAGE_KINDS } from '@dugrema/millegrilles.utiljs/src/constantes'

const CONST_TAILLE_BUFFER_COMMANDE = 100

const bluetooth = navigator.bluetooth

export async function requestDevice() {
    let device = null
    const configurerUuid = millegrillesServicesConst.services.commandes.uuid,
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

export async function chargerEtatAppareil(server) {
    try {
        if(!server.connected) {
            console.error("GATT connexion - echec")
            return
        }
        const service = await server.getPrimaryService(millegrillesServicesConst.services.etat.uuid)
        // console.debug("Service : ", service)
        const characteristics = await service.getCharacteristics()
        const etat = await lireEtatCharacteristics(characteristics)

        return etat
    } catch(err) {
        console.error("Erreur chargerEtatAppareil %O", err)
    }
}

async function transmettreString(characteristic, valeur) {
    const CONST_FIN = new Uint8Array(1)
    CONST_FIN.set(0, 0x0)

    let valeurArray = new TextEncoder().encode(valeur)

    while(valeurArray.length > 0) {
        let valSlice = valeurArray.slice(0, CONST_TAILLE_BUFFER_COMMANDE)
        valeurArray = valeurArray.slice(CONST_TAILLE_BUFFER_COMMANDE)
        await characteristic.writeValueWithResponse(valSlice)
    }

    // Envoyer char 0x0
    await characteristic.writeValueWithResponse(CONST_FIN)
}

export async function transmettreDict(characteristic, valeur) {
    return transmettreString(characteristic, JSON.stringify(valeur))
}

export async function transmettreDictChiffre(workers, server, authSharedSecret, commande) {
    const commandeString = JSON.stringify(commande)
    const commandeBytes = new TextEncoder().encode(commandeString)

    const resultat = await workers.chiffrage.chiffrage.chiffrer(
        commandeBytes, {cipherAlgo: 'chacha20-poly1305', key: authSharedSecret}
    )
    console.debug("Commande chiffree : %O (key input: %O)", resultat, authSharedSecret)
    const ciphertext = Buffer.from(resultat.ciphertext).toString('base64')
    const commandeChiffree = {
        ciphertext,
        nonce: Buffer.from(resultat.nonce.slice(1), 'base64').toString('base64'),  // Retrirer m multibase, utiliser base64 padding
        tag: Buffer.from(resultat.rawTag).toString('base64'),
    }
    const cb = async characteristic => {
        await transmettreDict(characteristic, commandeChiffree)
    }
    const commandeUuid = millegrillesServicesConst.services.commandes.uuid,
          setCommandUuid = millegrillesServicesConst.services.commandes.characteristics.setCommand
    await submitParamAppareil(server, commandeUuid, setCommandUuid, cb)
}

async function submitParamAppareil(server, serviceUuid, characteristicUuid, callback) {
    if(!server) throw new Error("Server manquant")
    if(!serviceUuid) throw new Error('serviceUuid vide')
    if(!characteristicUuid) throw new Error('characteristicUuid vide')

    console.debug("submitParamAppareil serviceUuid %s, characteristicUuid %s", serviceUuid, characteristicUuid)

    try {
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

        if(!traite) {
            throw new Error(`characteristic ${characteristicUuid} inconnue pour service ${serviceUuid}`)
        }

    } catch(err) {
        console.error("Erreur chargerEtatAppareil %O", err)
    }
}

async function chargerClePublique(server) {
    try {
        if(!server.connected) {
            console.error("GATT connexion - echec")
            return
        }
        const service = await server.getPrimaryService(millegrillesServicesConst.services.commandes.uuid)
        const characteristics = await service.getCharacteristics()
        
        for await(const characteristic of characteristics) {
            // console.debug("Lire characteristic " + characteristic.uuid)
            const uuidLowercase = characteristic.uuid.toLowerCase()
            switch(uuidLowercase) {
                case millegrillesServicesConst.services.commandes.characteristics.getAuth:
                    return await characteristic.readValue()
                default:
            }
        }
    
        throw Error('characteristic auth introuvable')
    } catch(err) {
        console.error("Erreur chargerEtatAppareil %O", err)
    }
}

async function lireEtatCharacteristics(characteristics) {
    // console.debug("Nombre characteristics : " + characteristics.length)
    const etat = {}
    for await(const characteristic of characteristics) {
        // console.debug("Lire characteristic " + characteristic.uuid)
        const uuidLowercase = characteristic.uuid.toLowerCase()
        switch(uuidLowercase) {
            case millegrillesServicesConst.services.etat.characteristics.getUserId:
                etat.userId = await readTextValue(characteristic)
                break
            case millegrillesServicesConst.services.etat.characteristics.getIdmg:
                etat.idmg = await readTextValue(characteristic)
                break
            case millegrillesServicesConst.services.etat.characteristics.getWifi:
                Object.assign(etat, await readWifi(characteristic))
                break
            case millegrillesServicesConst.services.etat.characteristics.getLectures:
                Object.assign(etat, await readLectures(characteristic))
                break
            default:
                console.warn("Characteristic etat inconnue : " + characteristic.uuid)
        }
    }
    return etat
}

async function readTextValue(characteristic) {
    const value = await characteristic.readValue()
    return new TextDecoder().decode(value)
}

function convertirBytesIp(adresse) {
    let adresseStr = adresse.join('.')
    return adresseStr
}

async function readWifi(characteristic) {
    const value = await characteristic.readValue()
    console.debug("readWifi value %O", value)
    const connected = value.getUint8(0) === 1,
          status = value.getUint8(1),
          channel = value.getUint8(2)
    const adressesSlice = value.buffer.slice(3, 19)
    const adressesList = new Uint8Array(adressesSlice)
    const ip = convertirBytesIp(adressesList.slice(0, 4))
    const subnet = convertirBytesIp(adressesList.slice(4, 8))
    const gateway = convertirBytesIp(adressesList.slice(8, 12))
    const dns = convertirBytesIp(adressesList.slice(12, 16))

    const ssidBytes = value.buffer.slice(19)
    const ssid = new TextDecoder().decode(ssidBytes)

    const etatWifi = {
        connected,
        status,
        channel,
        ip, subnet, gateway, dns,
        ssid
    }

    return etatWifi
}

async function readLectures(characteristic) {
    const value = await characteristic.readValue()
    console.debug("readLectures value %O", value)

    // Structure du buffer:
    // 0: NTP OK true/false
    // 1-4: int date epoch (secs)
    // 5-6: temp1 (small int)
    // 7-8: temp2 (small int)
    // 9-10: hum (small int)
    // 11: switch 1,2,3,4 avec bits 0=switch1 present, 1=switch1 ON/OFF, 2=switch2 present ...

    const etatNtp = value.getUint8(0) === 1
    const timeSliceVal = new Uint32Array(value.buffer.slice(1, 5))
    // console.debug("Time slice val ", timeSliceVal)
    const timeVal = timeSliceVal[0]
    const dateTime = new Date(timeVal * 1000)
    // console.debug("Time val : %O, Date %O", timeVal, dateTime)

    const lecturesNumeriques = new Int16Array(value.buffer.slice(5, 11))
    const temp1 = decoderValeurSmallint(lecturesNumeriques[0]),
          temp2 = decoderValeurSmallint(lecturesNumeriques[1]),
          hum = decoderValeurSmallint(lecturesNumeriques[2],{facteur: 10.0})

    const switches = decoderSwitches(value.getUint8(11))

    return {ntp: etatNtp, time: timeVal, temp1, temp2, hum, switches}
}

function decoderValeurSmallint(val, opts) {
    opts = opts || {}
    const facteur = opts.facteur || 100.0
    if(val === -32768) return null
    return val / facteur
}

function decoderSwitches(val) {
    const valeursListe = []
    for(let i = 0; i < 8; i++) {
        const boolVal = (val & 1 << i)?1:0
        valeursListe.push(boolVal)
    }
    // console.debug("Valeurs liste : ", valeursListe)
    const switches = []
    for(let sw=0; sw < 4; sw++) {
        const switchValue = {present: valeursListe[2*sw]?true:false}
        if(switchValue.present) {
            switchValue.valeur = valeursListe[2*sw+1]?true:false
        }
        switches.push(switchValue)
    }
    return switches
}

export async function authentifier(workers, bluetoothServer) {
    const publicPeerDataview = await chargerClePublique(bluetoothServer)
    const publicPeer = new Uint8Array(publicPeerDataview.buffer)
    console.debug("Cle publique peer pour auth ", publicPeer)

    // Generer keypair pour le chiffrage des commandes
    const keyPair = genererKeyPairX25519()
    const publicString = Buffer.from(keyPair.public).toString('hex')
    console.debug("Keypair : %O, public %s", keyPair, publicString)

    // Calculer shared secret
    const sharedSecret = await calculerSharedKey(keyPair.private, publicPeer)
    // console.debug("Shared secret : %s %O", Buffer.from(sharedSecret).toString('hex'), sharedSecret)

    // Transmettre cle publique
    const commande = {pubkey: publicString}
    const commandeSignee = await workers.chiffrage.formatterMessage(
        commande, 'SenseursPassifs',
        {kind: MESSAGE_KINDS.KIND_COMMANDE, action: 'authentifier'}
    )
    const cb = async characteristic => {
        await transmettreDict(characteristic, commandeSignee)
    }
    const commandeUuid = millegrillesServicesConst.services.commandes.uuid,
            setCommandUuid = millegrillesServicesConst.services.commandes.characteristics.setCommand
    await submitParamAppareil(bluetoothServer, commandeUuid, setCommandUuid, cb)

    // Verifier que la characteristic auth est vide (len: 0). Indique succes.
    let succes = false
    const fingerprint = commandeSignee.pubkey
    console.debug("Fingerprint certificat signature : ", fingerprint)
    for(let i=0; i<10; i++) {
        await new Promise(resolve=>setTimeout(resolve, 500))
        const confirmation = await chargerClePublique(bluetoothServer)
        const confirmationKeyString = Buffer.from(confirmation.buffer).toString('hex')
        console.debug("Confirmation auth : %s (%O)", confirmationKeyString, confirmation)
        if(confirmationKeyString === fingerprint) {
            console.debug("Auth succes")
            succes = true
            break
        }
    }

    if(succes) {
        // Retourner le shared secret pour activer les commandes authentifiees.
        return { sharedSecret }
    } else {
        console.error("Echec authentification")
    }    
}

export async function submitConfiguration(server, relai, idmg, userId) {
    const commandesUuid = millegrillesServicesConst.services.commandes.uuid,
          setCommandUuid = millegrillesServicesConst.services.commandes.characteristics.setCommand

    // Transmettre relai
    const cbRelai = async characteristic => {
        const params = {commande: 'setRelai', relai}
        await transmettreDict(characteristic, params)
    }
    const cbUser = async characteristic => {
        const params = {commande: 'setUser', idmg, user_id: userId}
        await transmettreDict(characteristic, params)
    }

    await submitParamAppareil(server, commandesUuid, setCommandUuid, cbRelai)
    console.debug("Params relai envoyes")
    await submitParamAppareil(server, commandesUuid, setCommandUuid, cbUser)
    console.debug("Params user envoyes")
}

export async function submitWifi(server, ssid, wifiPassword) {
    const cb = async characteristic => {
        const params = {commande: 'setWifi', ssid, password: wifiPassword}
        await transmettreDict(characteristic, params)
    }

    const commandeUuid = millegrillesServicesConst.services.commandes.uuid,
          setCommandUuid = millegrillesServicesConst.services.commandes.characteristics.setCommand

    await submitParamAppareil(server, commandeUuid, setCommandUuid, cb)
}
