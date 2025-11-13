# AWS Account exports from aws_accounts.json
if [[ -f ~/dot/.env/aws_accounts.json ]]; then
  while IFS= read -r account; do
    name=$(echo "$account" | jq -r '.name')
    id=$(echo "$account" | jq -r '.identifier.accountId')
    if [[ "$name" != "null" && "$id" != "null" ]]; then
      # Convert name to valid env var (uppercase, replace hyphens with underscores)
      var_name=$(echo "$name" | tr '[:lower:]' '[:upper:]' | tr '-' '_')
      export "AWS_ACCOUNT_${var_name}=${id}"
    fi
  done < <(jq -c '.conduitAccountList[]' ~/dot/.env/aws_accounts.json)
fi
