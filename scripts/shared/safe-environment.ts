const diagnosticVariables = /^(?:GH_DEBUG|GIT_CURL_VERBOSE|GIT_TRACE(?:_.*)?)$/i;

export function environmentWithoutCredentialTracing(additions: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const environment = { ...process.env, ...additions };
  for (const name of Object.keys(environment)) {
    if (diagnosticVariables.test(name)) delete environment[name];
  }
  return environment;
}

export function redactCredentials(value: string, environment: NodeJS.ProcessEnv = {}): string {
  let redacted = value;
  for (const [name, secret] of Object.entries(environment)) {
    if (!secret || secret.length < 6) continue;
    if (/(?:TOKEN|SECRET|PASSWORD|AUTHORIZATION|COOKIE)/i.test(name) || /authorization:/i.test(secret)) {
      redacted = redacted.replaceAll(secret, '[REDACTED]');
      const credential = secret.match(/(?:Bearer|Basic)\s+(\S+)/i)?.[1];
      if (credential) redacted = redacted.replaceAll(credential, '[REDACTED]');
    }
  }
  return redacted.replace(/(Bearer|Basic)\s+[A-Za-z0-9+/=_-]+/gi, '$1 [REDACTED]');
}
