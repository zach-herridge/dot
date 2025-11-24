# AWS Account exports from aws_accounts.json
if [[ -f ~/dot/.env/aws_accounts.json ]]; then
  eval "$(jq -r '.conduitAccountList[] | select(.name != null and .identifier.accountId != null) | "export AWS_ACCOUNT_" + (.name | ascii_upcase | gsub("-"; "_")) + "=" + .identifier.accountId' ~/dot/.env/aws_accounts.json)"
fi
