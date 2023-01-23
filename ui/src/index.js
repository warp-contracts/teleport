import './style';

export default function App() {
    return (
        <div class="container">
            <Nav></Nav>

            <section class="section">
                <Main></Main>
            </section>

            <Footer></Footer>
        </div >


    );
}

function Main() {
    return (
        <div>
            <h1 class="title">Buy NFT</h1>
            <h2 class="subtitle has-text-centered">
                Here you can buy NFTs from arweave, and pay for them using ERC20 tokens on Polygon.
            </h2>
            <div class="container">
                <div class="tabs">
                    <ul>
                        <li class="is-active"><a>All</a></li>
                        <li><a>In progress</a></li>
                        <li><a>Finished</a></li>
                    </ul>
                </div>
                <div class="card">
                    {/* <div class="card-image">
                        <figure class="image is-4by3">
                            <img src="https://bulma.io/images/placeholders/1280x960.png" alt="Placeholder image" />
                        </figure>
                    </div> */}
                    <div class="card-content">
                        <div class="media">
                            <div class="media-left">
                                <figure class="image is-48x48">
                                    <img src="https://bulma.io/images/placeholders/96x96.png" alt="Placeholder image" />
                                </figure>
                            </div>
                            <div class="media-content">
                                <p class="title is-4">John Smith</p>
                                <p class="subtitle is-6">@johnsmith</p>
                            </div>
                        </div>

                        <div class="content">
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                            Phasellus nec iaculis mauris. <a>@bulmaio</a>.
                            <a href="#">#css</a> <a href="#">#responsive</a>
                            <br />
                            <time datetime="2016-1-1">11:09 PM - 1 Jan 2016</time>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Footer() {
    return (
        <footer class="footer">
            <div class="content has-text-centered">
                <p>
                    <strong>Teleport</strong> developed by Warp Team.
                </p>
            </div>
        </footer>
    )
}

function Nav() {
    return (
        <nav class="navbar" role="navigation" aria-label="main navigation">
            <div class="navbar-brand">
                <a class="navbar-item is-size-2 is-uppercase is-family-monospace">
                    Teleport
                </a>

            </div>

            <div id="navbarBasicExample" class="navbar-menu">
                <div class="navbar-end">
                    <div class="navbar-item">
                        <div class="buttons">
                            <a class="button is-primary">
                                <strong>Buyer</strong>
                            </a>
                            <a class="button is-light">
                                Seller
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </nav >
    )
}