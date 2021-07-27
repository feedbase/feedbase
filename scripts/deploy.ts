const { ethers, network } = require("hardhat");
const fs = require("fs");

const IPFS = require('ipfs-core')

const FeedbaseJson = require("../artifacts/contracts/Feedbase.sol/Feedbase.json");
const OracleFactoryJson = require("../artifacts/contracts/Oracle.sol/OracleFactory.json");
const OracleJson = require("../artifacts/contracts/Oracle.sol/Oracle.json");

// Deploy function
async function deploy() {
   const { name } = network;

   const [account] = await ethers.getSigners();
   const deployerAddress = account.address;
   console.log(`Deploying contracts using ${deployerAddress}`);

   //Deploy Feedbase
   const Feedbase = await ethers.getContractFactory("Feedbase");
   const feedbase = await Feedbase.deploy();
   await feedbase.deployed();

   console.log(`Feedbase deployed to : `, feedbase.address);

   //Deploy OracleFactory
   const OracleFactory = await ethers.getContractFactory("OracleFactory");
   const oracleFactory = await OracleFactory.deploy(feedbase.address);
   await oracleFactory.deployed();

   console.log(`OracleFactory deployed to : `, oracleFactory.address);


   /**** create pack file ****/
   const node = await IPFS.create();

   // construct `type` object
   const artifacts = [OracleJson, OracleFactoryJson, FeedbaseJson];
   let types: any = {};

   let cids = [];
   for (let i = 0; i < artifacts.length; i++) {
      const str = JSON.stringify(artifacts[i]);
      const { cid } = await node.add(str);
      cids.push(cid.toString());
   }
   for (let i = 0; i < cids.length; i++) {
      types[artifacts[i].contractName] = { "artifacts": cids[i] };
   }

   // construct `object` object
   const objects: any = {
      "oracleFactory": {
         typename: OracleFactoryJson.contractName,
         artifacts: cids[1],
         addresses: {},
      },
      "feedbase": {
         typename: FeedbaseJson.contractName,
         artifacts: cids[2],
         addresses: {},
      }
   }

   objects["oracleFactory"].addresses[name] = oracleFactory.address;
   objects["feedbase"].addresses[name] = feedbase.address;

   let ans = { types, objects };
   let str = JSON.stringify(ans, null, 2);

   fs.writeFileSync("pack.json", str);

   console.log(str);
}

deploy()
   .then(() => process.exit(0))
   .catch((error) => {
      console.error(error);
      process.exit(1);
   });
