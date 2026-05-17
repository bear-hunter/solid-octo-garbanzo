import hre from "hardhat";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const Institutions = await hre.ethers.getContractFactory("InstitutionRegistry");
  const institutions = await Institutions.deploy();
  await institutions.waitForDeployment();
  const institutionRegistry = await institutions.getAddress();

  const Credentials = await hre.ethers.getContractFactory("CredentialRegistry");
  const credentials = await Credentials.deploy(institutionRegistry);
  await credentials.waitForDeployment();
  const credentialRegistry = await credentials.getAddress();

  const network = hre.network.name;
  const file = join(process.cwd(), `deployments.${network}.json`);
  writeFileSync(
    file,
    JSON.stringify({ network, institutionRegistry, credentialRegistry, deployedAt: new Date().toISOString() }, null, 2),
  );
  console.log(`Deployed to ${network}`);
  console.log(`  InstitutionRegistry: ${institutionRegistry}`);
  console.log(`  CredentialRegistry:  ${credentialRegistry}`);
  console.log(`  Wrote ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
