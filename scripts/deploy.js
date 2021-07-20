const { ethers } = require('hardhat');

// Deploy function
async function deploy() {
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


}

deploy()
   .then(() => process.exit(0))
   .catch((error) => {
      console.error(error);
      process.exit(1);
   });
