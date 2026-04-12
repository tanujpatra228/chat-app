const ApiError = require("../utils/ApiError");

function validate(schema, source = "body") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false });

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      throw new ApiError(400, messages);
    }

    req[source] = value;
    next();
  };
}

module.exports = validate;
