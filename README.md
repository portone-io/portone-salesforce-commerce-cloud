# README #

This README would normally document whatever steps are necessary to get your application up and running.

### What is this repository for? ###

* Quick summary
* Version
* [Learn Markdown](https://bitbucket.org/tutorials/markdowndemo)

### How do I get set up? ###

* Summary of set up
* Configuration
* Dependencies
* Database configuration
* How to run tests
* Deployment instructions

### Required changes ###
#### If you are working on SFRA 6
Go to link_import\cartridges\int_iamport_sfra\cartridge\config\preferences.js
And change to false the _SFRA5_ENABLED_ value
Go to link_import\cartridges\int_iamport_sfra\cartridge\client\default\js\checkout.js
And ensure to comment the line that import the checkoutSFRA5.js in order to not import unnecesary file
```
if (sfra5Enabled === 'true') {
		// processInclude(require('./checkout/checkoutSFRA5'));
		return;
	} else if (sfra5Enabled === 'false') {
		// Comment next line when you are working with SFRA 5. Uncomment on SFRA6
		processInclude(require('./checkout/checkoutSFRA6'));
		return;
	}
```
#### If you are working on SFRA 5
Go to link_import\cartridges\int_iamport_sfra\cartridge\config\preferences.js
And change to true the _SFRA5_ENABLED_ value
Go to link_import\cartridges\int_iamport_sfra\cartridge\client\default\js\checkout.js
And ensure to uncomment the line that import the checkoutSFRA5.js in order to not import unnecesary file and comment the line that imports checkoutSFRA6
```
if (sfra5Enabled === 'true') {
		processInclude(require('./checkout/checkoutSFRA5'));
		return;
	} else if (sfra5Enabled === 'false') {
		// Comment next line when you are working with SFRA 5. Uncomment on SFRA6
		// processInclude(require('./checkout/checkoutSFRA6'));
		return;
	}
```

### Contribution guidelines ###

* Writing tests
* Code review
* Other guidelines

### Who do I talk to? ###

* Repo owner or admin
* Other community or team contact