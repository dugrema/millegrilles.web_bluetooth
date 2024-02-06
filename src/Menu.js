import React, {Suspense, useState, useEffect, useMemo, useCallback} from 'react'
import { useTranslation } from 'react-i18next'

import Nav from 'react-bootstrap/Nav'
import Navbar from 'react-bootstrap/Navbar'
import NavDropdown from 'react-bootstrap/NavDropdown'

import { Menu as MenuMillegrilles, DropDownLanguage } from '@dugrema/millegrilles.reactjs'

function Menu(props) {

    const { i18n, setSectionAfficher } = props
  
    const { t } = useTranslation()
  
    const handlerSelect = useCallback(eventKey => {
        switch(eventKey) {
          case 'portail': window.location = '/millegrilles'; break
          case 'configurerAppareil': 
            setSectionAfficher(eventKey)
            break
          default:
            setSectionAfficher('')
        }
    }, [setSectionAfficher])
  
    const handlerChangerLangue = eventKey => {i18n.changeLanguage(eventKey)}
    const brand = (
        <Navbar.Brand>
            <Nav.Link onClick={handlerSelect} title={t('titre')}>
                {t('titre')}
            </Nav.Link>
        </Navbar.Brand>
    )
  
    return (
        <>
            <MenuMillegrilles 
                brand={brand} 
                labelMenu="Menu" 
                onSelect={handlerSelect} 
                i18nInstance={i18n}
                etatConnexion={true}>
  
              <Nav.Link eventKey="configurerAppareil" title="Configurer des appareils">
                  {t('menu.configurer')}
              </Nav.Link>
  
              <DropDownLanguage title={t('menu.language')} onSelect={handlerChangerLangue}>
                  <NavDropdown.Item eventKey="en-US">English</NavDropdown.Item>
                  <NavDropdown.Item eventKey="fr-CA">Francais</NavDropdown.Item>
              </DropDownLanguage>
  
            </MenuMillegrilles>
        </>
    )
  }

  export default Menu
