require("zach.core")
require("zach.lazy")

require('zach.cloudwatch').setup({
  log_groups = {},
  default_time_range = "1h"
})

