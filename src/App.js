import React, {Suspense, useState} from 'react'
import i18n from './i18n'

import Container from 'react-bootstrap/Container'
import { LayoutMillegrilles } from '@dugrema/millegrilles.reactjs'

import manifest from './manifest.build'

import 'react-bootstrap/dist/react-bootstrap.min.js'
import './App.css'


const Menu = React.lazy( () => import('./Menu') )

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
  const {sectionAfficher, setSectionAfficher} = props

  return (
    <LayoutMillegrilles>

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
  return 'Main'
}