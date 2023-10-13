import { task } from "hardhat/config";

task("verify").setAction(async function (_taskArgs, hre) {
  const nftAuction = await hre.deployments.get("NFTAuction");
  console.log("nftAuction", nftAuction.address);
  await hre.run("verify:verify", {
    address: nftAuction.address,
    constructorArguments: [],
  });
});
