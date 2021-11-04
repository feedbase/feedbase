## Feedbase

##### `(src,tag) -> (val,ttl)`

Feedbase is a simple and general contract layer for oracle systems.

Use Feedbase to:

* sell your unique data feeds into an ecosystem of consumers
* buy data feed updates from an ecosystem of data sources and aggregators

The idea is to factor the oracle problem into modular sub-problems which can be composed and evolved in the market.
Feedbase just provides a common data and payment routing object which can be manipulated by arbitrary contract code.

You can deploy your own oracle system or create a new aggregator from existing oracle systems.

You can bring own business logic for node selection and incentives.

Feedbase is a labor of love. There are no protocol fees and no protocol token.
Feedbase espouses composability and rejects vertical integration.
It is a true protocol, not a broker or service provider.


### What's inside

It comes with:

* The core Feedbase object
* A few basic combinators (time-delay, medianizer, quorum value)
* A "receiver" contract that interprets EIP712 signed messages, to decouple sensors and relays and manage key rotations for persistent oracle identities
* Basic sensor utilities to easily convert existing web 2.0 APIs into feedbase signed message streams

Here are some things that can be built over feedbase:

* Direct push
* Basic streamer / receiver / relayer
* Medianizer, immutable or dynamic/owned
* Chainlink adapter
* General 'private' MPT state stealer (aka MakerDAO adapter)
* Coinbase EIP712 adapter
* Prism node selection
* Other stake mode node selection

