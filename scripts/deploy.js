const { ethers, network } = require("hardhat");
const fs = require("fs");

// Deploy function
async function deploy() {
   const { chainId } = network.config;
   console.log("Network chainId: ", chainId);

   [account] = await ethers.getSigners();
   deployerAddress = account.address;
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

   const data = {
      feedbase: feedbase.address,
      oracleFactory: oracleFactory.address,
   };

   fs.writeFileSync(`deployed.json`, JSON.stringify(data, null, 4), (err) =>
      console.err(err)
   );
}

deploy()
   .then(() => process.exit(0))
   .catch((error) => {
      console.error(error);
      process.exit(1);
   });
