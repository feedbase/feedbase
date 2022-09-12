## Feedbase

##### `(src,tag) -> (val,ttl)`

Feedbase is a simple and general contract layer for oracle systems.
Feedbase is an [old idea](https://www.npmjs.com/package/feedbase),
revised with a simple design pattern to make the oracle ecosystem more modular and composable.

You can deploy your own oracle system or create a new aggregator from existing oracle systems.

You can bring own business logic for node selection and incentives.

Feedbase is a labor of love. There are no protocol fees and no protocol token.
Feedbase espouses composability and rejects vertical integration.
It is a true protocol, not a broker or service provider.

Use Feedbase to:

* sell your unique data feeds into an ecosystem of consumers
* buy data feed updates from an ecosystem of data sources and aggregators

Feedbase factors the oracle workflow into several modular components:

- An `oracle` is anything that publishes signed data, providing an attestation about some real-world value. A `primary oracle` is when the data *source* signs the message. A `secondary oracle` is a node that takes data from an existing source which publishes unsigned data, and signs it.
- A `relay` is anything that takes a signed message from an oracle, and submits it to that oracle's on-chain `receiver`. Note that an end user's browser is a perfectly valid relay. The user's frontend relays the value on demand, and the user pays for gas only when the value is needed on-chain.
- A `receiver` is a contract that takes a signed message, verifies the signature, then records the value in the feedbase contract. One example is the `BasicReceiver` contract in this repo. Another example could be a contract that interprets Coinbase's signed price data, verifies the signature, and pushes it to feedbase. We encourage using a Receiver contract to keep a persistent oracle identity while still allowing key rotations.
- An `adapter` is a contract that takes some existing on-chain data source, and pushes the data into feedbase, where it can utilize the network effect of various combinators. Two examples of adapters could be a Chainlink adapter, which pays LINK and ETH gas costs to copy data from the Chainlink oracle network, or a Uniswap TWAP adapter, which pays gas fees to copy Uniswap TWAP values.
- A `combinator` is a contract that pulls some values from the core feedbase contract, and pushes some aggregated result. The most familiar example is a `Medianizer`. Another example is a TWAP of other feedbase values.

At time of writing, different oracles services perform one or all of these functions, in a vertically integrated manner.

We imagine the ideal oracle flow to look like this:

1) Exchanges act as primary spot price oracles, exposing a traditional web API that publishes *signed* data.
2) Any dapp or user, when they need this data, *relay* it into the appropriate *receiver*.
3) In cases where more than one data feed need to be aggregated, like with a medianizer, the same dapp or user can poke the appropriate *combinator*.

A combinator can itself combine values from other combinators. Receivers and combinators can also manager their own payment flow, using whatever token makes the most sense for them.

### What's inside

The initial release comes with:

* The core Feedbase object
* A medianizer, configurable by any owner contract
* A `BasicReceiver` contract that interprets EIP712 signed messages, to decouple oracles from relays and manage key rotations for persistent oracle identities
* Basic sensor utilities to easily convert existing web 2.0 APIs into feedbase signed message streams

Here are some more ideas of what you can build:

* Uniswap TWAP adapter
* Chainlink adapter
* Coinbase EIP712 adapter
* General "private state stealer", using merkle proofs and the `BLOCKHASH` opcode.

### Oracle selection

The problem of selecting which `src` values to count as unique data sources can be solved in many ways.
Existing governance solutions, like Chainlink's multisig or Uniswap's token-vote, are one example.
An approval voting system like the one used in the Rico system is another promising approach.
