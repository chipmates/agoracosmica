# The KTX2 transcoder

Two files, served at `/basis/` and fetched by the KTX2 loader's worker at the
moment a compressed model is opened. They are not imported, so they cannot
ride in the bundle graph and have to stand here as files.

- `basis_transcoder.js` and `basis_transcoder.wasm`, copied unchanged from
  `three/examples/jsm/libs/basis/` (three r185.1). Same bytes, same sha256.
- Basis Universal, by Binomial LLC: <https://github.com/BinomialLLC/basis_universal>
- Licence, verbatim: Apache License 2.0
  (<https://github.com/BinomialLLC/basis_universal/blob/master/LICENSE>)

They are refreshed by copying them again after a three upgrade, never edited.
