import toast, { Toaster } from 'react-hot-toast';
import { ethers } from 'ethers';
import warp from './warp';
import { createGlobalState } from 'react-hooks-global-state';
import { OfferList } from './OfferList';
import { evmSignature } from 'warp-contracts-plugin-signature';

const initialState = { page: '0', connected: false, connection: null };
const { useGlobalState } = createGlobalState(initialState);

export default function App() {

  return (
    <>
      <div className="container">
        <Nav></Nav>

        <section className="section">
          <Routes></Routes>
        </section>

        <Footer></Footer>
      </div >
      <Toaster position='top-right' toastOptions={{ duration: 5000 }} />
    </>
  );
}

async function connect() {
  if (!window.ethereum) {
    throw Error("Ethereum provider missing!");
  }

  await window.ethereum.request({ method: 'eth_requestAccounts' });

  window.ethereum.on('accountsChanged', () => window.location.reload())
  window.ethereum.on('chainChanged', () => window.location.reload())

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const accounts = await provider.listAccounts();

  if (accounts.length === 0) {
    throw Error("No accounts!");
  }

  const address = accounts[0];

  return {
    address,
    evmProvider: provider,
    signer: provider.getSigner(),
  }
}


function Routes() {
  const [page] = useGlobalState('page');
  const [connected] = useGlobalState('connected');
  const [connection] = useGlobalState('connection');

  if (connected) {
    switch (page) {
      case "buy":
        return <OfferList connection={connection}></OfferList>;
      default:
        return <OfferList></OfferList>;
    }
  } else {
    return (
      <Connect></Connect>
    )
  }
}

function Connect() {
  const [_, setPage] = useGlobalState('page');
  const [connected, setConnected] = useGlobalState('connected');
  const [connection, setConnection] = useGlobalState('connection');


  function onConnect() {
    connect()
      .then(data => setConnection({ ...data, evmSignature, warp }))
      .then(() => toast.success("Connected!"))
      .then(() => { setPage("buy"); setConnected(true) })
      .catch(e => toast.error(e.message))
  }

  return (
    <>
      <div className="columns is-centered">
        <div className="column is-half has-text-centered">
          <button className="button is-info is-large" onClick={onConnect}>
            Connect
          </button>
        </div>
      </div>
    </>
  )
}




function Footer() {
  return (
    <footer className="footer">
      <div className="content has-text-centered">
        <p>
          <strong>Teleport</strong> developed by Warp Team.
        </p>
      </div>
    </footer>
  )
}

function Nav() {
  return (
    <nav className="navbar" role="navigation" aria-label="main navigation">
      < div className="navbar-brand" >
        <a className="navbar-item is-size-2 is-uppercase is-family-monospace">
          Teleport
        </a>

      </div >

      <div id="navbarBasicExample" className="navbar-menu">
        <div className="navbar-end">
          <div className="navbar-item">
            <div className="buttons">
              <a className="button is-primary">
                <strong>Buyer</strong>
              </a>
              <a className="button is-light">
                Seller
              </a>

            </div>
          </div>
        </div>
      </div>
    </nav >
  )
}

