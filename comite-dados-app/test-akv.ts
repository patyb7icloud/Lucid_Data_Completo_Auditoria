import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential } from "@azure/identity";

async function testAKV() {
  const vaultUrl = "https://key-vault-secrets.vault.azure.net";
  const secretName = "Databricks-AccessToken";

  console.log(`Testando conexão ao Key Vault: ${vaultUrl}`);
  try {
    const credential = new DefaultAzureCredential();
    const client = new SecretClient(vaultUrl, credential);
    
    console.log("Buscando segredo...");
    const secret = await client.getSecret(secretName);
    console.log("Segredo encontrado com sucesso! Valor length:", secret.value?.length);
  } catch (err: any) {
    console.error("ERRO:", err.message);
  }
}

testAKV();
