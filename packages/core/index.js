"use strict";

// El runtime canónico vive dentro de la skill para que cada instalación sea
// autocontenida. Este paquete conserva la API histórica del monorepo.
module.exports = require("../../skill/runtime/core");
