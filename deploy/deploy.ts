import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const nftAuction = await deploy("NFTAuction", {
    from: deployer,
    args: [],
    log: true,
  });

  console.log(`NFTAuction contract: `, nftAuction.address);
};
export default func;
func.id = "deploy_nftAuction"; // id required to prevent reexecution
func.tags = ["NFTAuction"];
