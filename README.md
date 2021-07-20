
Feedbase is a base mapping:

`(source,key) -> (value,ttl)`

along with:

* a standard for pushing signed data
* various aggregators for that data
* native data <-> payment flows for oracles and aggregators, in any token

This is just a common base contract. You (the devs) are expected to bring your own anti-sybil mechanisms and/or aggregators.

An Oracle consists of an on-chain key manager and persistent identity contract, and an off-chain script that publishes signed data that anyone can push to feedbase through that contract.

Oracles (data *providers*) do not have to pay gas. They just publish signed messages on a public URL.
These data producers get paid when their oracle value is consumed for the first time on-chain, which pushes an update to the canonical feedbase registry ("first read on chain" monetization strategy).

Aggregators can pass costs for updates along to end consumers using the same first-read-on-chain payment flow.
