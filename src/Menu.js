import React, {Suspense, useState, useEffect, useMemo, useCallback} from 'react'
import { useTranslation } from 'react-i18next'

import Nav from 'react-bootstrap/Nav'
import Navbar from 'react-bootstrap/Navbar'
import NavDropdown from 'react-bootstrap/NavDropdown'

import { Menu as MenuMillegrilles, DropDownLanguage } from '@dugrema/millegrilles.reactjs'

function Menu(props) {

    const { i18n, setSectionAfficher, estProprietaire } = props
  
    const { t } = useTranslation()
    const [showModalInfo, setShowModalInfo] = useState(false)
    const handlerCloseModalInfo = useCallback(()=>setShowModalInfo(false), [setShowModalInfo])
  
    const handlerSelect = useCallback(eventKey => {
        switch(eventKey) {
          case 'portail': window.location = '/millegrilles'; break
          case 'deconnecter': window.location = '/auth/deconnecter_usager'; break
          // case 'instances': setSectionAfficher('Instances'); break
          default:
            setSectionAfficher('')
        }
    }, [setSectionAfficher, setShowModalInfo])
  
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
                i18nInstance={i18n}>
  
              <Nav.Link eventKey="configuration" title="Configuration des appareils">
                  {t('menu.configuration')}
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
