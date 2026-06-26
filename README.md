# System-Ban-Discord

## Introduction
This Discord bot, developed by Wick Studio, offers an innovative solution for managing user conduct within Discord servers. It introduces a band system where administrators can temporarily restrict users' access to server channels based on specified reasons and durations. 

## Features
- **band System** : Temporarily move users to a restricted role (band) with limited permissions.
- **Customizable band Duration** : Set the duration for how long a user should remain in band.
- **Reason Specification** : Specify a reason for banding, which is logged and can be reviewed.
- **Automated Unbanding** : Automatically restore user's original roles and permissions after the band term expires.
- **band Logs** : View detailed logs of all band actions, including who was banded/unbanded, by whom, and for what reason.

## Setup Instructions
1. **Clone the Repository**
   ```bash
   git clone https://github.com/Chla7H/System-Ban-Discord.git
   cd System-Ban-Discord
   ```
2. **Install Dependencies**
   ```bash
   npm install
   ```
3. **Configuration**
   - Create a `config.js` file.
   - Fill in your bot's token and other relevant configuration options in `config.js`.
4. **Run the Bot**
   ```bash
   node index.js
   ```

## Usage
After setting up the bot and inviting it to your server, the following commands are available:
- `/band` : bands a user with a specific reason and duration.
- `/unband` : Unbands a user, restoring their previous roles.
- `/log` : Displays band logs for a specified user.

## Contributing
We welcome contributions from the community! If you'd like to contribute to the Mega Team Development® Discord Bot, please follow these steps:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature-name`).
3. Make your changes and commit them (`git commit -am 'Add some feature'`).
4. Push to the branch (`git push origin feature-name`).
5. Open a Pull Request.

## Support
Join us at our Discord server for support and community discussions : [discord.gg/mega](https://discord.gg/2P8UMqYuCf).

## License
This project is licensed under [MTD License](LICENSE). See the LICENSE file for more details.

## Acknowledgements
- Code by Mega Team Development®
- Discord.js Chla7

## Contact

[Mega Team Development®](https://discord.gg/2P8UMqYuCf)
