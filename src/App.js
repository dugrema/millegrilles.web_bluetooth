import React, {Suspense, useState} from 'react'
import i18n from './i18n'

import Container from 'react-bootstrap/Container'
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

const Menu = React.lazy( () => import('./Menu') )
const ConfigurerAppareil = React.lazy( () => import('./ConfigurerAppareil') )

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

          <Suspense fallback={<p>Loading...</p>}>
            <MainBody 
              sectionAfficher={sectionAfficher}
              setSectionAfficher={setSectionAfficher} />
          </Suspense>

      </Container>

    </LayoutMillegrilles>    
  )

}

function MainBody(props) {

  const {sectionAfficher} = props

  let SectionAfficher = null
  switch(sectionAfficher) {
    case 'configurerAppareil': SectionAfficher = ConfigurerAppareil; break
    default:
      SectionAfficher = DefaultBody
  }

  return <SectionAfficher {...props} />

}

function DefaultBody(props) {
  return (
    <div>
      <p>Choisir une action a partir du menu.</p>
    </div>
  )
}