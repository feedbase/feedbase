## Feedbase

##### `(src,tag) -> (val,ttl)`

Use Feedbase to:

* sell your unique data feeds into an ecosystem of consumers
* buy data feed updates from an ecosystem of data sources and aggregators

It comes with,

* A "receiver" contract that interprets EIP712 signed messages, to decouple sensors and relays and manage key rotations for persistent oracle identities
* A few basic combinators (time-delay, medianizer, quorum value)
* Basic sensor utilities to easily convert existing web 2.0 APIs into feedbase signed message streams

### What and how

Feedbase is a simple and general data layer for oracle systems.
It lets your bring your own business logic for node selection and incentives.
It also comes with an optional built-in token-agnostic payment flow to make composing paid feeds together easy.

You can deploy your own oracle system or create a new aggregator from existing oracle systems.
The idea is to factor the oracle problem into modular sub-problems which can be mixed and matched and evolved in the market.

Here are some specific examples of things that can be built over feedbase:

* Direct push
* Basic streamer / receiver / relayer
* Medianizer, immutable or dynamic/owned
* Chainlink adapter
* MakerDAO adapter (state stealer)
* Coinbase EIP712 adapter
* Prism node selection
* Other stake mode node selection


```
Tutorials
How-to
  Read available feeds using feedbase ABI and artifacts (feed-pack.json bundle)
  Run a feed source which can be relayed into a receiver
  Run a relay to published signed feed updates to a chain
  Consume a feed server's stream as an on-chain dapp
  Create your own medianizer for a fixed set of nodes
  Run a keeper that can get paid to maintain aggregator state
  Create a staking system to secure a set of feeds with bonded nodes
Reference
  Feedbase ABI
Discussions
  State of ecosystem, relation to chainlink, makerdao, and others
  Read about design decisions and guiding philosophy
  Read about aggregator patterns and different approach to staked/bonded data sources
  Read about the native payment flow and monetization strategies that it enables
```
