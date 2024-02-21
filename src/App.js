import React, {Suspense, useEffect, useState} from 'react'
import i18n from './i18n'

import Container from 'react-bootstrap/Container'
import Alert from 'react-bootstrap/Alert'

import { LayoutMillegrilles } from '@dugrema/millegrilles.reactjs'

import manifest from './manifest.build'

// Importer JS global
import 'react-bootstrap/dist/react-bootstrap.min.js'

// Importer cascade CSS global
import 'bootstrap/dist/css/bootstrap.min.css'
import 'font-awesome/css/font-awesome.min.css'
import '@dugrema/millegrilles.reactjs/dist/index.css'

import './index.scss'
import './App.css'

import ErrorBoundary from './ErrorBoundary'
import useWorkers, { WorkerProvider } from './WorkerContext'

const Menu = React.lazy( () => import('./Menu') )
const ConfigurerAppareil = React.lazy( () => import('./ConfigurerAppareil') )

const bluetooth = navigator.bluetooth

function App() {

  const [sectionAfficher, setSectionAfficher] = useState('')

  const menu = (
    <Menu
        i18n={i18n} 
        setSectionAfficher={setSectionAfficher} 
        manifest={manifest} />    
  )

  return (
    <div className="App">
      <header className="App-header">
        <LayoutApp 
          menu={menu} 
          sectionAfficher={sectionAfficher}
          setSectionAfficher={setSectionAfficher}/>
      </header>
    </div>
  )
}

export default App

function LayoutApp(props) {
  const {menu, sectionAfficher, setSectionAfficher} = props

  return (
    <LayoutMillegrilles menu={menu}>

      <div className='top-spacer-menu'></div>
      
      <Container className="contenu">

        <WorkerProvider attente={<Attente />}>
          <ErrorBoundary>
            <Suspense fallback={<p>Loading...</p>}>
              <MainBody 
                sectionAfficher={sectionAfficher}
                setSectionAfficher={setSectionAfficher} />
            </Suspense>
          </ErrorBoundary>
        </WorkerProvider>
      </Container>

    </LayoutMillegrilles>    
  )

}

function MainBody(props) {

  let {sectionAfficher} = props

  const [bluetoothAvailable, setBluetoothAvailable] = useState('')

  useEffect(()=>{
    if(bluetooth) {
      bluetooth.getAvailability()
        .then(available=>{
          if(available) setBluetoothAvailable(true)
          else setBluetoothAvailable(false)
        })
        .catch(err=>{
          console.err("Erreur detection bluetooth ", err)
          setBluetoothAvailable(false)
        })
    } else {
      setBluetoothAvailable(false)
    }
  }, [setBluetoothAvailable])

  if(!bluetoothAvailable) {
    if(bluetoothAvailable === '') sectionAfficher = 'detection'
    else if(bluetoothAvailable === false) sectionAfficher = 'nonSupporte'
  }

  let SectionAfficher = null
  switch(sectionAfficher) {
    case 'detection': SectionAfficher = BluetoothDetection; break
    case 'nonSupporte': SectionAfficher = BluetoothNonSupporte; break
    case 'configurerAppareil': SectionAfficher = ConfigurerAppareil; break
    default:
      SectionAfficher = DefaultBody
  }

  return <SectionAfficher {...props} />

}

function BluetoothDetection(props) {
  return (
    <p>Detection bluetooth</p>
  )
}

function BluetoothNonSupporte(props) {
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

function DefaultBody(props) {
  return (
    <div>
      <p>Choisir une action a partir du menu.</p>
    </div>
  )
}

function Attente(_props) {
  return (
      <div>
          <p className="titleinit">Preparation de Bluetooth</p>
          <p>Veuillez patienter durant le chargement de la page.</p>
          <ol>
              <li>Initialisation</li>
              <li>Chargement des composants dynamiques</li>
              <li>Connexion a la page</li>
          </ol>
      </div>
  )
}
