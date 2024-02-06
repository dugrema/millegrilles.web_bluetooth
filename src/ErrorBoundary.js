import { Component } from 'react'
import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/Container'

class ErrorBoundary extends Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }
  
    static getDerivedStateFromError(error) {
      return { hasError: true };
    }
  
    componentDidCatch(error, errorInfo) {
      if(this.props.errorCb) {
        this.props.erreurCb(error)
      } else {
        console.error("ErrorBoundary %O", error)
      }
    }
  
    render() {
      if (this.state.hasError) {
        return (
          <Container>
            <br />

            <Alert variant="danger">
              <Alert.Heading>Erreur</Alert.Heading>
              <p>Une erreur est survenue. La page ne peut pas etre affichee.</p>
            </Alert>

            <br />

            <Button onClick={reload}>Revenir</Button>
          </Container>
        )
      }
  
      return this.props.children; 
    }
}

export default ErrorBoundary

function reload() {
  window.location.reload()
}
